package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Customer admin (M6): projects, invitations (external domain confirmation, reissue, email change, acceptance), project
 * roles, deactivation with handover and reactivation, settings, outbox and audit log — each on its own tenant.
 */
class CustomerAdminIntegrationTest extends IntegrationTestBase {

    private static final Pattern INVITE = Pattern.compile("/invite/(\\S+)");

    // ------------------------------------------------------------------ helpers

    private long addUser(Tenant t, String local, String role) {
        String email = email(t, local);
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class,
                KIM_REQUESTER);
        jdbc.update("INSERT INTO users (customer_id, email, name, dept, active, pending, operator, demo, avatar_color, "
                + "password_hash, created_at, updated_at) VALUES (?, ?, ?, '테스트팀', 1, 0, 0, 0, '#123456', ?, ?, ?)",
                t.customerId(), email, "사용자 " + local, hash, now, now);
        long id = userId(email);
        if (role != null) {
            jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)", t.projectId(), id,
                    role);
        }
        return id;
    }

    private static String email(Tenant t, String local) {
        return local + t.requester().substring(t.requester().indexOf('@'));
    }

    private static String domain(Tenant t) {
        return t.requester().substring(t.requester().indexOf('@') + 1);
    }

    /** Submitted SMS request (WAITING). */
    private String submitted(Login req, long projectId) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", projectId, "type", "SMS"))
                .path("id").asString();
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "적립 안내", "hopeDueDate", "2026-12-20",
                "purpose", "안내", "target", "전체 회원", "background", "정기 발송"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("sender", "1588-0000",
                "body", "포인트가 적립되었습니다", "customerCenter", false, "optOut", false)));
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
        return id;
    }

    private void assign(Login lead, String id, List<Long> reviewers, long primary) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", reviewers);
        body.put("primaryReviewerId", primary);
        body.put("dueDate", "2026-12-15");
        body.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, post("/api/requests/" + id + "/assignment"), body);
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private int auditCount(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    private String lastAuditDetail(String action, long customerId) {
        return jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = ? AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, action, customerId);
    }

    /**
     * Token of the newest invitation mail to the address. The admin's outbox masks the link (non-sample customer), so
     * the token is read from the stored mail, as the recipient's mailbox would show it.
     */
    private String inviteToken(Login admin, long customerId, String to) throws Exception {
        boolean listed = false;
        for (JsonNode mail : getJson(admin, "/api/customers/" + customerId + "/outbox?size=100").path("content")) {
            if (mail.path("to").asString().equals(to) && mail.path("subject").asString().equals("TX TMS 초대")) {
                assertThat(mail.path("body").asString()).contains("/invite/••••").contains("링크는 수신자에게만 전달됩니다");
                assertThat(mail.path("masked").asBoolean()).isTrue();
                listed = true;
                break;
            }
        }
        assertThat(listed).as("invitation mail to " + to + " listed in the outbox").isTrue();
        String body = jdbc.queryForObject("SELECT body FROM outbound_emails WHERE to_address = ? AND subject = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, to, "TX TMS 초대");
        Matcher m = INVITE.matcher(body);
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    private int loginStatus(String email, String password) throws Exception {
        String body = json.writeValueAsString(Map.of("email", email, "password", password, "remember", false));
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)).andReturn()
                .getResponse().getStatus();
    }

    private JsonNode member(Login admin, long customerId, long userId) throws Exception {
        for (JsonNode m : getJson(admin, "/api/customers/" + customerId + "/members")) {
            if (m.path("user").path("id").asLong() == userId) {
                return m;
            }
        }
        throw new AssertionError("no member " + userId);
    }

    private static List<String> roles(JsonNode member, long projectId) {
        List<String> out = new ArrayList<>();
        for (JsonNode p : member.path("projects")) {
            if (p.path("projectId").asLong() == projectId) {
                p.path("roles").forEach(r -> out.add(r.asString()));
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ tests

    @Test
    void accessIsLimitedToTheCustomersAdmins() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login otherAdmin = login(KANG_ADMIN);
        Login operator = login(JUNG_OPERATOR);
        String base = "/api/customers/" + t.customerId();
        assertThat(expect(403, req, get(base + "/members"), null).path("message").asString())
                .isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(403, operator, get(base + "/members"), null);
        expect(404, otherAdmin, get(base + "/members"), null);
        expect(404, otherAdmin, patch(base + "/settings"), Map.of("name", "x"));
        expect(403, req, get(base + "/outbox"), null);
        expect(403, req, get(base + "/audit-logs"), null);
        expect(404, otherAdmin, patch("/api/projects/" + t.projectId()), Map.of("name", "x"));
        expect(403, req, post(base + "/projects"), Map.of("name", "x"));
    }

    @Test
    void projectsInvitationsRolesSettingsOutboxAndAudit() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        Login lead = login(t.lead());
        String base = "/api/customers/" + t.customerId();
        long reviewerId = userId(t.reviewer());
        long requesterId = userId(t.requester());

        // ---- project create
        assertThat(expect(400, admin, post(base + "/projects"), Map.of("leadUserId", reviewerId)).path("message")
                .asString()).isEqualTo("프로젝트 이름을(를) 입력하세요");
        assertThat(expect(400, admin, post(base + "/projects"), Map.of("name", "새 프로젝트")).path("message")
                .asString()).isEqualTo("대표 검수자을(를) 입력하세요");
        assertThat(expect(400, admin, post(base + "/projects"), Map.of("name", "새 프로젝트", "leadUserId",
                reviewerId, "approverIds", List.of(reviewerId))).path("message").asString())
                .isEqualTo("이 고객사는 승인 단계를 쓰지 않습니다");
        expect(400, admin, post(base + "/projects"), Map.of("name", "새 프로젝트", "leadUserId", userId(KIM_REQUESTER)));
        JsonNode created = expect(201, admin, post(base + "/projects"), Map.of("name", "새 프로젝트", "leadUserId",
                requesterId));
        long newProject = created.path("id").asLong();
        assertThat(created.path("leadUserId").asLong()).isEqualTo(requesterId);
        assertThat(created.path("members").get(0).path("roles").get(0).asString()).isEqualTo("REVIEWER");
        assertThat(auditCount("프로젝트 생성", t.customerId())).isEqualTo(1);
        assertThat(lastAuditDetail("프로젝트 생성", t.customerId())).isEqualTo("대표 사용자 req, 승인자 없음");

        // ---- project edit: a requester of the project cannot lead it; deactivation waits for in-progress requests
        assertThat(expect(400, admin, patch("/api/projects/" + t.projectId()), Map.of("leadUserId", requesterId))
                .path("message").asString()).isEqualTo("요청자 역할을 가진 사용자는 대표 검수자가 될 수 없습니다");
        String id = submitted(req, t.projectId());
        JsonNode blocked = expect(409, admin, patch("/api/projects/" + t.projectId()), Map.of("active", false));
        assertThat(blocked.path("code").asString()).isEqualTo("REQUEST_STATE_CONFLICT");
        assertThat(blocked.path("message").asString()).startsWith("진행 중인 요청이 1건 있어 사용 중지할 수 없습니다");
        expect(200, req, post("/api/requests/" + id + "/cancel"), Map.of("rowVersion", rowVersion(req, id)));
        JsonNode stopped = expect(200, admin, patch("/api/projects/" + t.projectId()),
                Map.of("active", false, "name", "작성 테스트 변경"));
        assertThat(stopped.path("active").asBoolean()).isFalse();
        assertThat(lastAuditDetail("프로젝트 변경", t.customerId())).contains("이름 ").contains("상태 사용 → 중지");
        expect(200, admin, patch("/api/projects/" + t.projectId()), Map.of("active", true));
        JsonNode relead = expect(200, admin, patch("/api/projects/" + t.projectId()), Map.of("leadUserId",
                reviewerId));
        assertThat(relead.path("leadUserId").asLong()).isEqualTo(reviewerId);
        assertThat(lastAuditDetail("프로젝트 변경", t.customerId()))
                .isEqualTo("대표 사용자 lead, 승인자 없음 → 대표 사용자 rev, 승인자 없음");

        // ---- invitation: validation, duplicate, external domain confirmation
        String external = "guest-" + t.customerId() + "@partner.example";
        assertThat(expect(400, admin, post(base + "/invitations"), Map.of("name", "손님")).path("message").asString())
                .isEqualTo("이메일을(를) 입력하세요");
        assertThat(expect(400, admin, post(base + "/invitations"), Map.of("email", "bad", "name", "손님"))
                .path("message").asString()).isEqualTo("이메일 형식을 확인하세요");
        assertThat(expect(409, admin, post(base + "/invitations"), Map.of("email", t.reviewer().toUpperCase(),
                "name", "중복")).path("code").asString()).isEqualTo("DUPLICATE");
        JsonNode confirm = expect(409, admin, post(base + "/invitations"), Map.of("email", external, "name", "손님",
                "projectId", t.projectId(), "role", "REQUESTER"));
        assertThat(confirm.path("code").asString()).isEqualTo("EXTERNAL_DOMAIN_CONFIRM_REQUIRED");
        assertThat(expect(400, admin, post(base + "/invitations"), Map.of("email", external, "name", "손님",
                "projectId", t.projectId(), "role", "APPROVER", "externalDomainConfirmed", true)).path("message")
                .asString()).isEqualTo("이 고객사는 승인 단계를 쓰지 않습니다");
        Instant before = clock.instant();
        JsonNode invited = expect(201, admin, post(base + "/invitations"), Map.of("email", external, "name", "손님",
                "dept", "협력사", "projectId", t.projectId(), "role", "REQUESTER", "externalDomainConfirmed", true));
        long guestId = invited.path("user").path("id").asLong();
        assertThat(invited.path("pending").asBoolean()).isTrue();
        assertThat(invited.path("user").path("active").asBoolean()).isFalse();
        assertThat(invited.path("admin").asBoolean()).isFalse();
        assertThat(roles(invited, t.projectId())).containsExactly("REQUESTER");
        assertThat(Duration.between(before, Instant.parse(invited.path("invitationExpiresAt").asString())))
                .isBetween(Duration.ofDays(7).minusMinutes(1), Duration.ofDays(7).plusMinutes(1));
        assertThat(auditCount("사용자 초대", t.customerId())).isEqualTo(1);
        String first = inviteToken(admin, t.customerId(), external);
        assertThat(getJson(admin, "/api/auth/tokens/" + first).path("valid").asBoolean()).isTrue();

        // ---- reissue: the previous link stops working
        expect(204, admin, post(base + "/users/" + guestId + "/invitation/reissue"), null);
        String second = inviteToken(admin, t.customerId(), external);
        assertThat(second).isNotEqualTo(first);
        assertThat(getJson(admin, "/api/auth/tokens/" + first).path("valid").asBoolean()).isFalse();
        assertThat(auditCount("초대 재발급", t.customerId())).isEqualTo(1);
        assertThat(expect(409, admin, post(base + "/users/" + reviewerId + "/invitation/reissue"), null)
                .path("message").asString()).isEqualTo("초대 대기 중인 사용자만 초대 링크를 재발급할 수 있습니다");

        // ---- email change of the pending user: confirmation again for an external domain, new link
        String moved = "guest-" + t.customerId() + "@" + domain(t);
        assertThat(expect(400, admin, patch(base + "/users/" + guestId + "/email"), Map.of("email", "x@"))
                .path("message").asString()).isEqualTo("이메일 형식 또는 중복을 확인하세요");
        expect(409, admin, patch(base + "/users/" + guestId + "/email"), Map.of("email", t.lead()));
        expect(409, admin, patch(base + "/users/" + guestId + "/email"), Map.of("email", "g2@partner.example"));
        JsonNode changed = expect(200, admin, patch(base + "/users/" + guestId + "/email"), Map.of("email", moved));
        assertThat(changed.path("user").path("email").asString()).isEqualTo(moved);
        assertThat(lastAuditDetail("사용자 이메일 변경", t.customerId())).isEqualTo(external + " → " + moved);
        assertThat(getJson(admin, "/api/auth/tokens/" + second).path("valid").asBoolean()).isFalse();
        String third = inviteToken(admin, t.customerId(), moved);

        // ---- acceptance through the token endpoint, then a normal login
        MvcResult accepted = mvc.perform(post("/api/auth/tokens/" + third + "/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "손님 본명", "password", "Welcome!2026")))).andReturn();
        assertThat(accepted.getResponse().getStatus()).isEqualTo(200);
        Login guest = login(moved, "Welcome!2026", false);
        assertThat(guest.me().path("name").asString()).isEqualTo("손님 본명");
        JsonNode active = member(admin, t.customerId(), guestId);
        assertThat(active.path("pending").asBoolean()).isFalse();
        assertThat(active.path("user").path("active").asBoolean()).isTrue();
        assertThat(active.path("invitationExpiresAt").isNull()).isTrue();

        // ---- project roles
        String rolesUrl = base + "/users/" + guestId + "/project-roles";
        assertThat(expect(400, admin, put(rolesUrl), Map.of("projects", List.of(Map.of("projectId", t.projectId(),
                "roles", List.of("REQUESTER", "REVIEWER"))))).path("message").asString())
                .isEqualTo("요청자와 검수자는 함께 줄 수 없습니다");
        assertThat(expect(400, admin, put(rolesUrl), Map.of("projects", List.of(Map.of("projectId", t.projectId(),
                "roles", List.of("APPROVER"))))).path("message").asString()).isEqualTo("이 고객사는 승인 단계를 쓰지 않습니다");
        long otherProject = projectId("카드 혜택 알림");
        expect(404, admin, put(rolesUrl), Map.of("projects", List.of(Map.of("projectId", otherProject,
                "roles", List.of("REQUESTER")))));
        JsonNode reviewerNow = expect(200, admin, put(rolesUrl), Map.of("projects", List.of(
                Map.of("projectId", t.projectId(), "roles", List.of("REVIEWER")),
                Map.of("projectId", newProject, "roles", List.of("REQUESTER")))));
        assertThat(roles(reviewerNow, t.projectId())).containsExactly("REVIEWER");
        assertThat(roles(reviewerNow, newProject)).containsExactly("REQUESTER");
        assertThat(lastAuditDetail("역할 변경", t.customerId()))
                .isEqualTo("작성 테스트 변경: 요청자 → 검수자 / 새 프로젝트: 없음 → 요청자");
        // the lead keeps the reviewer role
        assertThat(expect(400, admin, put(base + "/users/" + reviewerId + "/project-roles"), Map.of("projects",
                List.of(Map.of("projectId", t.projectId(), "roles", List.of())))).path("message").asString())
                .startsWith("작성 테스트 변경: 대표 검수자의 검수자 역할은 해제할 수 없습니다");
        // empty roles remove the membership row
        JsonNode removed = expect(200, admin, put(rolesUrl), Map.of("projects", List.of(
                Map.of("projectId", newProject, "roles", List.of()))));
        assertThat(roles(removed, newProject)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM project_members WHERE project_id = ? AND user_id = ?",
                Integer.class, newProject, guestId)).isZero();
        // an assigned reviewer of an unfinished review keeps the role
        String inReview = submitted(req, t.projectId());
        Login newLead = login(t.reviewer());
        assign(newLead, inReview, List.of(guestId), guestId);
        assertThat(expect(400, admin, put(rolesUrl), Map.of("projects", List.of(Map.of("projectId", t.projectId(),
                "roles", List.of("REQUESTER"))))).path("message").asString())
                .isEqualTo("작성 테스트 변경: 진행 중인 검수가 있어 검수자 역할을 해제할 수 없습니다. 먼저 검수자를 변경하세요");

        // ---- members list
        JsonNode adminMember = member(admin, t.customerId(), userId(t.admin()));
        assertThat(adminMember.path("admin").asBoolean()).isTrue();
        JsonNode leadMember = member(admin, t.customerId(), reviewerId);
        assertThat(leadMember.path("projects").get(0).path("lead").asBoolean()).isTrue();
        assertThat(lead.userId()).isPositive();

        // ---- settings
        assertThat(expect(400, admin, patch(base + "/settings"), Map.of("dueSoonDays", 15)).path("message").asString())
                .isEqualTo("납기 임박 기준은 1~14일입니다");
        expect(400, admin, patch(base + "/settings"), Map.of("name", " "));
        JsonNode settings = expect(200, admin, patch(base + "/settings"), Map.of("name", "새 고객사명",
                "notifyChannel", "IN_APP_EMAIL", "dueSoonDays", 2, "domain", "ignored.example"));
        assertThat(settings.path("name").asString()).isEqualTo("새 고객사명");
        assertThat(settings.path("notifyChannel").asString()).isEqualTo("IN_APP_EMAIL");
        assertThat(settings.path("dueSoonDays").asInt()).isEqualTo(2);
        assertThat(settings.path("domain").asString()).isEqualTo(domain(t));
        assertThat(lastAuditDetail("고객사 설정 변경", t.customerId())).contains("업무 알림 채널 제품 내 알림 → 제품 내 알림 + 이메일")
                .contains("납기 임박 기준 3일 → 2일");
        expect(200, admin, patch(base + "/settings"), Map.of("dueSoonDays", 2));
        assertThat(auditCount("고객사 설정 변경", t.customerId())).isEqualTo(1); // no change, no record

        // ---- outbox and audit log pages (customer scoped, newest first)
        JsonNode outbox = getJson(admin, base + "/outbox?size=2");
        assertThat(outbox.path("page").path("totalElements").asInt()).isEqualTo(3);
        assertThat(outbox.path("content")).hasSize(2);
        assertThat(outbox.path("content").get(0).path("to").asString()).isEqualTo(moved);
        assertThat(outbox.path("content").get(0).path("status").asString()).isEqualTo("PENDING");
        JsonNode audits = getJson(admin, base + "/audit-logs");
        assertThat(audits.path("content").get(0).path("action").asString()).isEqualTo("고객사 설정 변경");
        audits.path("content").forEach(a -> assertThat(a.path("customerId").asLong()).isEqualTo(t.customerId()));
        assertThat(getJson(login(KANG_ADMIN), "/api/customers/" + customerId("hanbitcard.co.kr") + "/outbox")
                .path("content").toString()).doesNotContain(moved);
    }

    @Test
    void deactivationHandsOverReviewsAndLeadThenReactivation() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        Login lead = login(t.lead());
        String base = "/api/customers/" + t.customerId();
        long reviewerId = userId(t.reviewer());
        long leadId = userId(t.lead());
        long rev2 = addUser(t, "rev2", "REVIEWER");
        long requester2 = userId(t.requester2());

        String id = submitted(req, t.projectId());
        assign(lead, id, List.of(reviewerId, leadId), reviewerId);
        Login reviewer = login(t.reviewer());
        expect(200, reviewer, post("/api/requests/" + id + "/contents/C1/lock"), null);

        // ---- impact
        JsonNode impact = getJson(admin, base + "/users/" + reviewerId + "/deactivation-impact");
        assertThat(impact.path("reviewing")).hasSize(1);
        assertThat(impact.path("reviewing").get(0).path("id").asString()).isEqualTo(id);
        assertThat(impact.path("requesting")).isEmpty();
        assertThat(impact.path("leadProjects")).isEmpty();
        assertThat(impact.path("lastAdmin").asBoolean()).isFalse();
        JsonNode reqImpact = getJson(admin, base + "/users/" + userId(t.requester()) + "/deactivation-impact");
        assertThat(reqImpact.path("requesting").get(0).path("id").asString()).isEqualTo(id);

        // ---- refusals
        String deactivate = base + "/users/" + reviewerId + "/deactivate";
        assertThat(expect(409, admin, post(base + "/users/" + userId(t.admin()) + "/deactivate"), null)
                .path("message").asString()).isEqualTo("본인 계정은 비활성화할 수 없습니다");
        JsonNode ownRequests = expect(409, admin, post(base + "/users/" + userId(t.requester()) + "/deactivate"),
                null);
        assertThat(ownRequests.path("details").get(0).asString()).isEqualTo(id);
        assertThat(expect(400, admin, post(deactivate), Map.of("handover", "인계")).path("message").asString())
                .isEqualTo("대체자을(를) 입력하세요");
        assertThat(expect(400, admin, post(deactivate), Map.of("substituteUserId", rev2)).path("message")
                .asString()).isEqualTo("인수인계 내용을(를) 입력하세요");
        assertThat(expect(400, admin, post(deactivate), Map.of("substituteUserId", requester2, "handover", "인계"))
                .path("message").asString()).isEqualTo("대체자는 같은 고객사의 활성 검수자여야 합니다");
        // requester2 becomes a reviewer elsewhere (lead of a new project) but stays a requester here
        expect(201, admin, post(base + "/projects"), Map.of("name", "보조 프로젝트", "leadUserId", requester2));
        assertThat(expect(400, admin, post(deactivate), Map.of("substituteUserId", requester2, "handover", "인계"))
                .path("message").asString()).isEqualTo("해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다");

        // ---- deactivation with handover
        expect(204, admin, post(deactivate), Map.of("substituteUserId", rev2, "handover", "C1 링크 확인 필요"));
        JsonNode detail = getJson(admin, "/api/requests/" + id);
        assertThat(detail.path("primaryReviewerId").asLong()).isEqualTo(rev2);
        assertThat(detail.path("reviewerIds").toString()).isEqualTo("[" + rev2 + "," + leadId + "]");
        assertThat(detail.path("contents").get(0).path("lock").isNull()).isTrue();
        assertThat(jdbc.queryForObject("SELECT detail FROM request_history WHERE request_id = ? AND action = '검수자 변경'",
                String.class, id)).isEqualTo("사용자 rev 비활성화로 사용자 rev2에게 인수인계\nC1 링크 확인 필요");
        assertThat(jdbc.queryForObject("SELECT detail FROM request_history WHERE request_id = ? AND action = "
                + "'편집 잠금 해제'", String.class, id)).isEqualTo("사용자 비활성화로 사용자 rev님의 잠금 해제");
        assertThat(jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND text = ? ORDER BY "
                + "user_id", Long.class, id, "적립 안내 검수를 사용자 rev2님이 이어받았습니다"))
                .containsExactly(userId(t.requester()), rev2);
        assertThat(jdbc.queryForObject("SELECT reason FROM request_assignment_changes WHERE request_id = ?",
                String.class, id)).isEqualTo("사용자 rev 비활성화");
        assertThat(member(admin, t.customerId(), reviewerId).path("user").path("active").asBoolean()).isFalse();
        assertThat(getAs(reviewer, "/api/me").andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(loginStatus(t.reviewer(), DEMO_PASSWORD)).isEqualTo(401);
        assertThat(lastAuditDetail("사용자 비활성화", t.customerId()))
                .isEqualTo("대체자 사용자 rev2 / 검수 인계 " + id);
        expect(409, admin, post(deactivate), Map.of("substituteUserId", rev2, "handover", "x"));

        // ---- lead transfer: the substitute must not be a requester of the led project
        String leadDeactivate = base + "/users/" + leadId + "/deactivate";
        Login rev2Login = login(email(t, "rev2"));
        // the lead is still assigned in review → its review goes to the substitute as well
        assertThat(expect(400, admin, post(leadDeactivate), Map.of("substituteUserId", requester2, "handover", "x"))
                .path("message").asString()).isEqualTo("해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다");
        // a question to the requester blocks every assigned reviewer's deactivation
        expect(200, rev2Login, post("/api/requests/" + id + "/asks"), Map.of("contentKey", "C1", "question",
                "링크 확인 부탁드립니다", "rowVersion", rowVersion(rev2Login, id)));
        JsonNode blocked = expect(409, admin, post(leadDeactivate), Map.of("substituteUserId", rev2, "handover", "x"));
        assertThat(blocked.path("message").asString())
                .isEqualTo("확인 요청·승인 대기 중에는 담당자를 변경할 수 없습니다. 해당 업무를 먼저 처리하세요");
        assertThat(blocked.path("details").get(0).asString()).isEqualTo(id);
        long askId = getJson(req, "/api/requests/" + id).path("asks").get(0).path("id").asLong();
        expect(200, req, post("/api/requests/" + id + "/asks/" + askId + "/answer"), Map.of("answer", "확인했습니다",
                "rowVersion", rowVersion(req, id)));
        expect(204, admin, post(leadDeactivate), Map.of("substituteUserId", rev2, "handover", "대표 업무 인계"));
        assertThat(getJson(admin, "/api/projects/" + t.projectId()).path("leadUserId").asLong()).isEqualTo(rev2);
        assertThat(getJson(admin, "/api/requests/" + id).path("reviewerIds").toString()).isEqualTo("[" + rev2 + "]");
        assertThat(lead.userId()).isEqualTo(leadId);

        // ---- reactivation
        expect(204, admin, post(base + "/users/" + reviewerId + "/reactivate"), null);
        assertThat(member(admin, t.customerId(), reviewerId).path("user").path("active").asBoolean()).isTrue();
        assertThat(loginStatus(t.reviewer(), DEMO_PASSWORD)).isEqualTo(200);
        expect(409, admin, post(base + "/users/" + reviewerId + "/reactivate"), null);
        assertThat(auditCount("사용자 재활성화", t.customerId())).isEqualTo(1);
    }

    @Test
    void approvalCustomerProjectsKeepAnApprover() throws Exception {
        Tenant t = newTenant();
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        long approver = addUser(t, "appr", "APPROVER");
        long approver2 = addUser(t, "appr2", null);
        Login admin = login(t.admin());
        String base = "/api/customers/" + t.customerId();

        assertThat(expect(400, admin, post(base + "/projects"), Map.of("name", "승인 프로젝트", "leadUserId",
                userId(t.reviewer()))).path("message").asString()).isEqualTo("승인자를 한 명 이상 지정하세요");
        JsonNode created = expect(201, admin, post(base + "/projects"), Map.of("name", "승인 프로젝트", "leadUserId",
                userId(t.reviewer()), "approverIds", List.of(approver2)));
        assertThat(created.path("members").toString()).contains("APPROVER");
        expect(400, admin, patch("/api/projects/" + t.projectId()), Map.of("approverIds", List.of()));

        // the only active approver can neither lose the role nor be deactivated
        assertThat(expect(400, admin, put(base + "/users/" + approver + "/project-roles"), Map.of("projects",
                List.of(Map.of("projectId", t.projectId(), "roles", List.of())))).path("message").asString())
                .endsWith("마지막 승인자라 해제할 수 없습니다");
        JsonNode impact = getJson(admin, base + "/users/" + approver + "/deactivation-impact");
        assertThat(impact.path("lastApproverProjects").get(0).path("id").asLong()).isEqualTo(t.projectId());
        assertThat(expect(409, admin, post(base + "/users/" + approver + "/deactivate"), null).path("message")
                .asString()).isEqualTo("마지막 승인자입니다. 새 승인자를 먼저 지정하세요");
        // with a second approver the project keeps one
        JsonNode replaced = expect(200, admin, patch("/api/projects/" + t.projectId()), Map.of("approverIds",
                List.of(approver, approver2)));
        assertThat(replaced.path("members").toString()).contains(String.valueOf(approver2));
        expect(204, admin, post(base + "/users/" + approver + "/deactivate"), null);
        assertThat(lastAuditDetail("사용자 비활성화", t.customerId())).isNull();
    }
}
