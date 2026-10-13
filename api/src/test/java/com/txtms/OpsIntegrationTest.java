package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.txtms.global.storage.FileStorage;
import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Solution operator (M7): customers, initial setup up to a first Alimtalk submission, deactivation, content types,
 * sample data and the sample reset (which must never touch other customers), dashboard, outbox masking. Write tests
 * run on their own tenants; the reset test restores the demo tenants to their seed.
 */
class OpsIntegrationTest extends IntegrationTestBase {

    private static final Pattern INVITE = Pattern.compile("/invite/([A-Za-z0-9_-]+)");
    private static final String PASSWORD = "Welcome!2026";
    static final byte[] PDF = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);

    @Autowired
    private FileStorage storage;

    // ------------------------------------------------------------------ helpers

    private static String uniqueDomain() {
        return "m7-" + Math.abs(System.nanoTime() % 1_000_000_000L) + ".test";
    }

    private String storedToken(String to) {
        String body = jdbc.queryForObject("SELECT body FROM outbound_emails WHERE to_address = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, to);
        Matcher m = INVITE.matcher(body);
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    private Login accept(String email, String name) throws Exception {
        String token = storedToken(email);
        int status = mvc.perform(post("/api/auth/tokens/" + token + "/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", name, "password", PASSWORD))))
                .andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(200);
        return login(email, PASSWORD, false);
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private int auditCount(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    private static JsonNode byId(JsonNode array, long id) {
        for (JsonNode n : array) {
            if (n.path("id").asLong() == id) {
                return n;
            }
        }
        throw new AssertionError("no element " + id);
    }

    private static List<String> todoKinds(JsonNode dashboard, long customerId) {
        List<String> kinds = new ArrayList<>();
        for (JsonNode t : dashboard.path("todos")) {
            if (t.path("customerId").asLong() == customerId) {
                kinds.add(t.path("kind").asString());
            }
        }
        return kinds;
    }

    private String smsDraft(Login req, long projectId) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", projectId, "type", "SMS"))
                .path("id").asString();
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "적립 안내", "hopeDueDate", "2026-12-20",
                "purpose", "안내", "target", "전체 회원", "background", "정기 발송"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("sender", "1588-0000",
                "body", "포인트가 적립되었습니다", "customerCenter", false, "optOut", false)));
        return id;
    }

    private List<String> requestIdsOfCustomer(long customerId) {
        return jdbc.queryForList("SELECT r.id FROM requests r JOIN projects p ON p.id = r.project_id "
                + "WHERE p.customer_id = ? ORDER BY r.id", String.class, customerId);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void onlyOperatorsReachTheOpsApiAndOperatorsNeverReadRequests() throws Exception {
        Login admin = login(KANG_ADMIN);
        Login req = login(KIM_REQUESTER);
        Login operator = login(JUNG_OPERATOR);
        for (String path : List.of("/api/ops/dashboard", "/api/ops/customers", "/api/ops/outbox",
                "/api/ops/audit-logs", "/api/ops/setup-logs", "/api/ops/content-types")) {
            assertThat(expect(403, admin, get(path), null).path("message").asString()).as(path)
                    .isEqualTo("운영 담당자 권한이 필요합니다");
            expect(403, req, get(path), null);
        }
        expect(403, admin, post("/api/ops/customers"), Map.of("name", "x", "domain", "x.co.kr"));
        assertThat(expect(403, admin, post("/api/ops/sample-reset"), null).path("message").asString())
                .isEqualTo("시연 데이터 초기화는 솔루션 운영 담당자만 실행할 수 있습니다");
        expect(403, admin, put("/api/ops/projects/" + projectId("카드 혜택 알림") + "/templates"), List.of());
        expect(403, admin, patch("/api/ops/content-types/SMS"), Map.of("active", false));
        assertThat(mvc.perform(get("/api/ops/dashboard")).andReturn().getResponse().getStatus()).isEqualTo(401);
        // the operator never reads customer content
        expect(404, operator, get("/api/requests/REQ-2609-101"), null);
        expect(404, operator, get("/api/requests?projectId=" + projectId("카드 혜택 알림")), null);
    }

    @Test
    void customerOnboardingUpToAFirstAlimtalkSubmission() throws Exception {
        Login operator = login(JUNG_OPERATOR);
        String domain = uniqueDomain();

        // ---- customer creation
        assertThat(expect(400, operator, post("/api/ops/customers"), Map.of("name", " ", "domain", domain))
                .path("message").asString()).isEqualTo("고객사 이름을(를) 입력하세요");
        assertThat(expect(400, operator, post("/api/ops/customers"), Map.of("name", "신규", "domain", "no-tld"))
                .path("message").asString()).isEqualTo("도메인 형식을 확인하세요");
        JsonNode dup = expect(409, operator, post("/api/ops/customers"),
                Map.of("name", "중복", "domain", "@HanbitCard.co.kr"));
        assertThat(dup.path("code").asString()).isEqualTo("DUPLICATE");
        assertThat(dup.path("message").asString()).startsWith("한빛카드이(가) 같은 도메인을 쓰고 있습니다");

        JsonNode created = expect(201, operator, post("/api/ops/customers"),
                Map.of("name", "새봄은행", "domain", " @" + domain.toUpperCase() + " ", "approvalEnabled", false));
        long cid = created.path("id").asLong();
        assertThat(created.path("domain").asString()).isEqualTo(domain);
        assertThat(created.path("approvalEnabled").asBoolean()).isFalse();
        assertThat(created.path("sample").asBoolean()).isFalse();
        assertThat(created.path("active").asBoolean()).isTrue();
        assertThat(created.path("notifyChannel").asString()).isEqualTo("IN_APP");
        assertThat(created.path("dueSoonDays").asInt()).isEqualTo(3);
        assertThat(created.path("projectCount").asLong()).isEqualTo(1);
        assertThat(created.path("adminAssigned").asBoolean()).isFalse();
        assertThat(created.path("unassignedDatasetTypes")).hasSize(3); // Phase 1 types (RCS deferred)
        assertThat(created.path("createdBy").asLong()).isEqualTo(operator.userId());
        assertThat(created.path("createdByName").asString()).isEqualTo("정우진");
        assertThat(getJson(operator, "/api/ops/customers/" + cid).path("createdByName").asString())
                .isEqualTo("정우진");
        // the list is paged in id order (default size 20): the newest customer is the last row of the last page
        JsonNode firstPage = getJson(operator, "/api/ops/customers");
        assertThat(firstPage.path("page").path("number").asInt()).isZero();
        assertThat(firstPage.path("page").path("size").asInt()).isEqualTo(20);
        long total = firstPage.path("page").path("totalElements").asLong();
        assertThat(firstPage.path("content")).hasSize((int) Math.min(total, 20));
        JsonNode lastRow = getJson(operator, "/api/ops/customers?size=1&page=" + (total - 1)).path("content").get(0);
        assertThat(lastRow.path("id").asLong()).isEqualTo(cid);
        assertThat(lastRow.path("createdByName").asString()).isEqualTo("정우진");
        assertThat(getJson(operator, "/api/ops/customers?size=1&page=" + total).path("content")).isEmpty();
        Map<String, Object> defaultProject = jdbc.queryForMap(
                "SELECT id, name, lead_user_id FROM projects WHERE customer_id = ?", cid);
        assertThat(defaultProject.get("name")).isEqualTo("기본 프로젝트");
        assertThat(defaultProject.get("lead_user_id")).isNull();
        assertThat(auditCount("고객사 생성", cid)).isEqualTo(1);
        JsonNode logPage = getJson(operator, "/api/ops/setup-logs?customerId=" + cid);
        assertThat(logPage.path("page").path("totalElements").asLong()).isEqualTo(2);
        assertThat(logPage.path("page").path("size").asInt()).isEqualTo(20);
        JsonNode logs = logPage.path("content");
        assertThat(logs).hasSize(2);
        assertThat(getJson(operator, "/api/ops/setup-logs?customerId=" + cid + "&page=1&size=1").path("content")
                .get(0).path("action").asString()).isEqualTo("고객사 생성");
        assertThat(logs.get(0).path("action").asString()).isEqualTo("기본 프로젝트 생성");
        assertThat(logs.get(0).path("result").asString()).isEqualTo("첫 고객사 관리자 초대 필요");
        assertThat(logs.get(1).path("action").asString()).isEqualTo("고객사 생성");
        assertThat(logs.get(1).path("actorName").asString()).isEqualTo("정우진");

        // ---- dashboard before the admin exists
        JsonNode dashboard = getJson(operator, "/api/ops/dashboard");
        assertThat(todoKinds(dashboard, cid)).containsExactly("INVITE_ADMIN", "ASSIGN_DATASETS");
        int active = jdbc.queryForObject("SELECT COUNT(*) FROM customers WHERE active = 1", Integer.class);
        assertThat(dashboard.path("kpis").path("activeCustomers").asInt()).isEqualTo(active);
        assertThat(dashboard.path("kpis").path("customersWithoutAdmin").asInt()).isPositive();
        assertThat(dashboard.path("recentAudit")).hasSize(6);
        assertThat(dashboard.path("recentAudit").get(0).path("action").asString()).isEqualTo("프로젝트 생성");
        assertThat(dashboard.path("recentAudit").get(0).path("customerId").asLong()).isEqualTo(cid);
        assertThat(dashboard.path("recentAudit").get(0).path("actorName").asString()).isEqualTo("정우진");
        JsonNode row = byId(dashboard.path("customers"), cid);
        assertThat(row.path("userCount").asLong()).isZero();
        for (JsonNode t : dashboard.path("todos")) {
            if (t.path("customerId").asLong() == cid && t.path("kind").asString().equals("ASSIGN_DATASETS")) {
                assertThat(t.path("route").asString()).isEqualTo("opsStandards");
                assertThat(t.path("sub").asString()).isEqualTo("assign");
                assertThat(t.path("count").asInt()).isEqualTo(3); // Phase 1 types (RCS deferred)
                assertThat(t.path("label").asString()).isEqualTo("유효 데이터셋 3개 조합 배정");
            }
        }

        // ---- first admin (external domain needs the confirmation)
        String base = "/api/ops/customers/" + cid;
        String bossEmail = "boss-" + domain.replace('.', '-') + "@gmail.com";
        Map<String, Object> adminInvite = new HashMap<>(Map.of("email", bossEmail, "name", "한봄", "dept", "경영지원",
                "admin", true));
        assertThat(expect(409, operator, post(base + "/invitations"), adminInvite).path("code").asString())
                .isEqualTo("EXTERNAL_DOMAIN_CONFIRM_REQUIRED");
        assertThat(expect(400, operator, post(base + "/invitations"),
                Map.of("email", "not-an-email", "name", "x", "admin", true)).path("message").asString())
                .isEqualTo("이메일 형식 또는 중복을 확인하세요");
        assertThat(expect(409, operator, post(base + "/invitations"),
                Map.of("email", KANG_ADMIN, "name", "x", "admin", true)).path("message").asString())
                .isEqualTo("이메일 형식 또는 중복을 확인하세요");
        assertThat(expect(400, operator, post(base + "/invitations"),
                Map.of("email", "w@" + domain, "name", "x", "admin", false)).path("message").asString())
                .isEqualTo("프로젝트가 필요합니다");
        adminInvite.put("externalDomainConfirmed", true);
        JsonNode invited = expect(201, operator, post(base + "/invitations"), adminInvite);
        assertThat(invited.path("pending").asBoolean()).isTrue();
        assertThat(invited.path("admin").asBoolean()).isTrue();
        assertThat(auditCount("사용자 초대", cid)).isEqualTo(1);

        // demo mode: the operator outbox shows the link; outside demo mode it is masked (OutboxMaskingTest)
        boolean seen = false;
        for (JsonNode mail : getJson(operator, "/api/ops/outbox?size=100").path("content")) {
            if (mail.path("to").asString().equals(bossEmail)) {
                assertThat(mail.path("body").asString()).contains("/invite/" + storedToken(bossEmail));
                assertThat(mail.path("masked").asBoolean()).isFalse();
                assertThat(mail.path("customerId").asLong()).isEqualTo(cid);
                seen = true;
                break;
            }
        }
        assertThat(seen).isTrue();

        Login boss = accept(bossEmail, "한봄");
        assertThat(boss.me().path("adminCustomerIds").toString()).contains(String.valueOf(cid));
        getJson(boss, "/api/customers/" + cid + "/members");
        // the customer admin's outbox (not a sample customer) never shows the token
        JsonNode adminOutbox = getJson(boss, "/api/customers/" + cid + "/outbox").path("content");
        assertThat(adminOutbox.get(0).path("body").asString()).contains("/invite/••••")
                .contains("링크는 수신자에게만 전달됩니다").doesNotContain(storedToken(bossEmail));
        assertThat(adminOutbox.get(0).path("masked").asBoolean()).isTrue();
        assertThat(todoKinds(getJson(operator, "/api/ops/dashboard"), cid)).containsExactly("ASSIGN_DATASETS");

        // ---- initial project (lead = the admin) and a work user
        assertThat(expect(400, operator, post(base + "/projects"), Map.of("name", " ")).path("message").asString())
                .isEqualTo("프로젝트 이름을(를) 입력하세요");
        expect(400, operator, post(base + "/projects"), Map.of("name", "x", "leadUserId", userId(KIM_REQUESTER)));
        JsonNode project = expect(201, operator, post(base + "/projects"),
                Map.of("name", "고객 안내 알림톡", "leadUserId", boss.userId()));
        long pid = project.path("id").asLong();
        assertThat(project.path("leadUserId").asLong()).isEqualTo(boss.userId());
        assertThat(project.path("templates")).isEmpty();
        assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = '프로젝트 생성' AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, cid)).isEqualTo("초기 설정, 대표 한봄");
        String writerEmail = "writer@" + domain;
        JsonNode writerMember = expect(201, operator, post(base + "/invitations"), Map.of("email", writerEmail,
                "name", "작성자", "admin", false, "projectId", pid, "role", "REQUESTER"));
        assertThat(writerMember.path("admin").asBoolean()).isFalse();
        assertThat(writerMember.path("projects").get(0).path("roles").get(0).asString()).isEqualTo("REQUESTER");
        Login writer = accept(writerEmail, "작성자");

        // ---- without templates the Alimtalk request cannot be submitted
        String rid = expect(201, writer, post("/api/requests"), Map.of("projectId", pid, "type", "ALIMTALK"))
                .path("id").asString();
        expect(200, writer, patch("/api/requests/" + rid), Map.of("title", "가입 환영", "hopeDueDate", "2026-12-20",
                "purpose", "가입 안내", "target", "신규 가입 고객", "background", "온보딩"));
        expect(200, writer, put("/api/requests/" + rid + "/contents/C1"), Map.of("payload",
                Map.of("templateCode", "M7_WELCOME_01", "body", "가입을 환영합니다", "buttons", List.of())));
        JsonNode check = expect(200, writer, post("/api/requests/" + rid + "/submit-check"), null);
        assertThat(check.path("ok").asBoolean()).isFalse();
        assertThat(check.path("details").toString()).contains("템플릿");

        // ---- Alimtalk templates set by the operator
        String tpl = "/api/ops/projects/" + pid + "/templates";
        expect(403, boss, put(tpl), List.of(Map.of("code", "M7_WELCOME_01", "name", "가입 환영")));
        assertThat(expect(400, operator, put(tpl), List.of(Map.of("code", "bad code", "name", "x")))
                .path("message").asString()).isEqualTo("템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다");
        JsonNode withTemplates = expect(200, operator, put(tpl),
                List.of(Map.of("code", " M7_WELCOME_01 ", "name", "가입 환영"), Map.of("code", "M7_BILL_02", "name", "청구")));
        assertThat(withTemplates.path("templates").get(0).path("code").asString()).isEqualTo("M7_WELCOME_01");
        assertThat(withTemplates.path("templates")).hasSize(2);
        // reorder and drop (rows are re-inserted, no unique-key clash)
        expect(200, operator, put(tpl), List.of(Map.of("code", "M7_BILL_02", "name", "청구"),
                Map.of("code", "M7_WELCOME_01", "name", "가입 환영")));
        expect(200, operator, put(tpl), List.of(Map.of("code", "M7_BILL_02", "name", "청구"),
                Map.of("code", "M7_WELCOME_01", "name", "가입 환영"))); // unchanged: no audit
        assertThat(auditCount("프로젝트 알림톡 템플릿 변경", cid)).isEqualTo(2);
        assertThat(auditCount("프로젝트 발신 정보 변경", cid)).isZero();
        assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = '프로젝트 알림톡 템플릿 변경' "
                + "AND customer_id = ? ORDER BY id DESC LIMIT 1", String.class, cid))
                .isEqualTo("알림톡 템플릿 M7_WELCOME_01, M7_BILL_02 → M7_BILL_02, M7_WELCOME_01");
        // sender numbers are no longer registered per project
        expect(404, operator, put("/api/ops/projects/" + pid + "/senders"), List.of("1588-1234"));
        assertThat(withTemplates.has("senders")).isFalse();
        expect(404, operator, put("/api/ops/projects/999999/templates"), List.of());
        assertThat(getJson(writer, "/api/projects/" + pid).path("templates")).hasSize(2);

        JsonNode submitted = expect(200, writer, post("/api/requests/" + rid + "/submit"),
                Map.of("rowVersion", rowVersion(writer, rid)));
        assertThat(submitted.path("status").asString()).isEqualTo("WAITING");
        assertThat(getJson(operator, "/api/ops/setup-logs?customerId=" + cid).path("content").toString())
                .contains("템플릿 등록")
                .doesNotContain("발신번호 등록").contains("초기 프로젝트 생성").contains("초대 링크 생성");
        JsonNode customerRow = getJson(operator, "/api/ops/customers/" + cid);
        assertThat(customerRow.path("activeRequestCount").asLong()).isEqualTo(1);
        assertThat(customerRow.path("projectCount").asLong()).isEqualTo(2);
        assertThat(customerRow.path("userCount").asLong()).isEqualTo(2);
        assertThat(customerRow.path("admins").get(0).path("name").asString()).isEqualTo("한봄");
        // operator audit listing: one customer, newest first
        JsonNode audits = getJson(operator, "/api/ops/audit-logs?customerId=" + cid + "&size=100").path("content");
        audits.forEach(a -> assertThat(a.path("customerId").asLong()).isEqualTo(cid));
        assertThat(audits.get(0).path("action").asString()).isEqualTo("프로젝트 알림톡 템플릿 변경");
    }

    @Test
    void operatorReadsMembersProjectsOutboxAndOperatorNamesOfACustomerEvenWhenInactive() throws Exception {
        Tenant t = newTenant();
        long cid = t.customerId();
        Login operator = login(JUNG_OPERATOR);
        Login tenantAdmin = login(t.admin());
        Login req = login(t.requester());
        String base = "/api/ops/customers/" + cid;
        String domain = t.requester().substring(t.requester().indexOf('@') + 1);

        // ---- operators only (customer admins included), 401 without a token, NOT_FOUND for a missing customer
        for (String path : List.of(base, base + "/members", base + "/projects", base + "/setup-context",
                "/api/ops/customers", "/api/ops/customers/options", "/api/ops/outbox?customerId=" + cid)) {
            assertThat(expect(403, tenantAdmin, get(path), null).path("message").asString()).as(path)
                    .isEqualTo("운영 담당자 권한이 필요합니다");
            expect(403, req, get(path), null);
            assertThat(mvc.perform(get(path)).andReturn().getResponse().getStatus()).as(path).isEqualTo(401);
        }
        expect(404, operator, get("/api/ops/customers/999999/members"), null);
        expect(404, operator, get("/api/ops/customers/999999/projects"), null);
        expect(404, operator, get("/api/ops/customers/999999/setup-context"), null);
        expect(404, operator, get("/api/ops/customers/999999"), null);
        expect(404, operator, get("/api/ops/outbox?customerId=999999"), null);

        // ---- the customer was not created by an operator: no creator name
        JsonNode row = getJson(operator, "/api/ops/customers/" + cid);
        assertThat(row.has("createdByName")).isTrue();
        assertThat(row.path("createdByName").isNull()).isTrue();

        // ---- the operator invitation answers the outbox id of its mail (Member keys stay at the top level)
        String inviteeEmail = "invitee@" + domain;
        JsonNode invited = expect(201, operator, post(base + "/invitations"), Map.of("email", inviteeEmail,
                "name", "초대 검수자", "admin", false, "projectId", t.projectId(), "role", "REVIEWER"));
        long mailId = invited.path("mailId").asLong();
        assertThat(mailId).isEqualTo(jdbc.queryForObject("SELECT id FROM outbound_emails WHERE to_address = ?",
                Long.class, inviteeEmail));
        assertThat(invited.has("member")).isFalse();
        assertThat(invited.path("user").path("email").asString()).isEqualTo(inviteeEmail);
        assertThat(invited.path("pending").asBoolean()).isTrue();
        // the customer admin's invitation keeps the plain Member
        JsonNode plain = expect(201, tenantAdmin, post("/api/customers/" + cid + "/invitations"),
                Map.of("email", "plain@" + domain, "name", "일반 초대"));
        assertThat(plain.has("mailId")).isFalse();

        // ---- outbox of one customer, newest first; demo mode shows the operator the link
        JsonNode outbox = getJson(operator, "/api/ops/outbox?customerId=" + cid + "&size=100");
        JsonNode mails = outbox.path("content");
        assertThat(mails).hasSize(2);
        mails.forEach(m -> assertThat(m.path("customerId").asLong()).isEqualTo(cid));
        assertThat(mails.get(0).path("to").asString()).isEqualTo("plain@" + domain);
        assertThat(mails.get(1).path("id").asLong()).isEqualTo(mailId);
        assertThat(mails.get(1).path("kind").asString()).isEqualTo("INVITATION");
        assertThat(mails.get(1).path("masked").asBoolean()).isFalse();
        assertThat(mails.get(1).path("body").asString()).contains("/invite/" + storedToken(inviteeEmail));
        // a mail of another customer, created here so the comparison does not depend on other tests' data
        Tenant other = newTenant();
        jdbc.update("INSERT INTO outbound_emails (customer_id, to_address, subject, body, kind, status, created_at)"
                + " VALUES (?, 'other@example.com', 'TX TMS 초대', 'body', 'INVITATION', 'PENDING', UTC_TIMESTAMP(6))",
                other.customerId());
        assertThat(getJson(operator, "/api/ops/outbox?size=1").path("page").path("totalElements").asLong())
                .isGreaterThan(outbox.path("page").path("totalElements").asLong());

        // ---- members: the customer admin's list shape, pending users included
        JsonNode memberPage = getJson(operator, base + "/members");
        assertThat(memberPage.toString()).isEqualTo(getJson(tenantAdmin, "/api/customers/" + cid + "/members")
                .toString());
        assertThat(memberPage.path("page").path("totalElements").asLong()).isEqualTo(7);
        JsonNode members = memberPage.path("content");
        assertThat(members).hasSize(7);
        JsonNode secondPage = getJson(operator, base + "/members?page=1&size=5");
        assertThat(secondPage.path("content")).hasSize(2);
        assertThat(secondPage.path("page").path("totalPages").asInt()).isEqualTo(2);
        assertThat(secondPage.path("content").get(0).path("user").path("id").asLong())
                .isEqualTo(members.get(5).path("user").path("id").asLong());
        JsonNode invitee = null;
        for (JsonNode m : members) {
            if (m.path("user").path("email").asString().equals(inviteeEmail)) {
                invitee = m;
            }
        }
        assertThat(invitee).isNotNull();
        assertThat(invitee.path("pending").asBoolean()).isTrue();
        assertThat(invitee.path("invitationExpiresAt").isNull()).isFalse();
        assertThat(invitee.path("projects").get(0).path("roles").get(0).asString()).isEqualTo("REVIEWER");

        // ---- projects: metadata only, no activeRequestCount
        JsonNode projectPage = getJson(operator, base + "/projects");
        assertThat(projectPage.path("page").path("totalElements").asLong()).isEqualTo(1);
        JsonNode projects = projectPage.path("content");
        assertThat(projects).hasSize(1);
        assertThat(projects.get(0).path("id").asLong()).isEqualTo(t.projectId());
        assertThat(projects.get(0).path("templates").get(0).path("code").asString()).isEqualTo("HB_POINT_01");
        assertThat(projects.get(0).has("senders")).isFalse();
        assertThat(projects.get(0).has("activeRequestCount")).isFalse();

        // ---- dataset assignment: operator names of the assignment and the confirmation
        long sms = jdbc.queryForObject("SELECT id FROM datasets WHERE scope = 'SMS' ORDER BY version DESC LIMIT 1",
                Long.class);
        JsonNode assigned = expect(200, operator, put(base + "/dataset-assignments/SMS"), Map.of("datasetId", sms));
        assertThat(assigned.path("assignedByName").asString()).isEqualTo("정우진");
        assertThat(assigned.has("checkedByName")).isTrue();
        assertThat(assigned.path("checkedByName").isNull()).isTrue();
        JsonNode confirmed = expect(200, operator, post(base + "/dataset-assignments/SMS/confirm"), null);
        assertThat(confirmed.path("checkedBy").asLong()).isEqualTo(operator.userId());
        assertThat(confirmed.path("checkedByName").asString()).isEqualTo("정우진");
        JsonNode listed = null;
        for (JsonNode a : getJson(operator, "/api/ops/dataset-assignments")) {
            if (a.path("customerId").asLong() == cid && a.path("type").asString().equals("SMS")) {
                listed = a;
            }
        }
        assertThat(listed).isNotNull();
        assertThat(listed.path("assignedByName").asString()).isEqualTo("정우진");
        assertThat(listed.path("checkedByName").asString()).isEqualTo("정우진");

        // ---- an inactive customer stays readable for the operator (the customer API closes it)
        expect(200, operator, post(base + "/deactivate"), Map.of("reason", "계약 종료"));
        assertThat(getJson(operator, base + "/members").path("content")).hasSize(7);
        assertThat(getJson(operator, base + "/projects").path("content")).hasSize(1);
        // setup working data and the detail stay readable too; the reference list keeps inactive customers
        JsonNode context = getJson(operator, base + "/setup-context");
        assertThat(context.path("projects").toString()).isEqualTo(projects.toString());
        assertThat(context.path("members")).hasSize(7);
        assertThat(getJson(operator, base).path("active").asBoolean()).isFalse();
        boolean inOptions = false;
        for (JsonNode c : getJson(operator, "/api/ops/customers/options")) {
            if (c.path("id").asLong() == cid) {
                inOptions = true;
                assertThat(c.path("active").asBoolean()).isFalse();
                assertThat(c.has("projectCount")).as("Customer shape").isFalse();
            }
        }
        assertThat(inOptions).isTrue();
        assertThat(getJson(operator, "/api/ops/outbox?customerId=" + cid).path("content")).hasSize(2);
        expect(404, operator, get("/api/customers/" + cid + "/projects"), null);
    }

    @Test
    void deactivationEndsSessionsUntilReactivation() throws Exception {
        Tenant t = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login req = login(t.requester());
        String base = "/api/ops/customers/" + t.customerId();
        String id = smsDraft(req, t.projectId());
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));

        assertThat(expect(400, operator, post(base + "/deactivate"), Map.of("reason", " ")).path("message")
                .asString()).isEqualTo("비활성 사유을(를) 입력하세요");
        assertThat(expect(409, operator, post(base + "/deactivate"), Map.of("reason", "계약 종료")).path("message")
                .asString()).isEqualTo("진행 중 요청 1건을 먼저 정리하거나 담당자와 합의해야 합니다");
        expect(200, req, post("/api/requests/" + id + "/cancel"), Map.of("rowVersion", rowVersion(req, id)));

        JsonNode off = expect(200, operator, post(base + "/deactivate"), Map.of("reason", "계약 종료"));
        assertThat(off.path("active").asBoolean()).isFalse();
        assertThat(off.path("deactivationReason").asString()).isEqualTo("계약 종료");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_sessions s JOIN users u ON u.id = s.user_id "
                + "WHERE u.customer_id = ? AND s.revoked_at IS NULL", Integer.class, t.customerId())).isZero();
        expect(401, req, get("/api/me"), null);
        String loginBody = json.writeValueAsString(Map.of("email", t.requester(), "password", DEMO_PASSWORD,
                "remember", false));
        var refused = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody))
                .andReturn();
        assertThat(refused.getResponse().getStatus()).isEqualTo(401);
        assertThat(read(refused).path("message").asString()).isEqualTo("비활성 계정 또는 고객사입니다");
        assertThat(expect(409, operator, post(base + "/deactivate"), Map.of("reason", "x")).path("message")
                .asString()).isEqualTo("이미 비활성 상태인 고객사입니다");
        assertThat(expect(409, operator, post(base + "/projects"), Map.of("name", "x")).path("message").asString())
                .isEqualTo("비활성 고객사입니다. 사용 재개 후 진행하세요");
        assertThat(getJson(operator, "/api/ops/customers/" + t.customerId()).path("active").asBoolean())
                .isFalse();
        assertThat(getJson(operator, "/api/ops/audit-logs?customerId=" + t.customerId()).path("content").get(0)
                .path("detail").asString()).isEqualTo("계약 종료");

        JsonNode on = expect(200, operator, post(base + "/reactivate"), null);
        assertThat(on.path("active").asBoolean()).isTrue();
        assertThat(on.path("deactivationReason").isNull()).isTrue();
        assertThat(auditCount("고객사 사용 재개", t.customerId())).isEqualTo(1);
        Login again = login(t.requester());
        getJson(again, "/api/requests/" + id);
        assertThat(expect(409, operator, post(base + "/reactivate"), null).path("message").asString())
                .isEqualTo("사용 중인 고객사입니다");
        expect(404, operator, post("/api/ops/customers/999999/reactivate"), null);
    }

    @Test
    void inactiveContentTypesCannotBeChosenButExistingRequestsStay() throws Exception {
        Tenant t = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login req = login(t.requester());
        String existing = smsDraft(req, t.projectId());
        String alimtalk = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(),
                "type", "ALIMTALK")).path("id").asString();
        try {
            JsonNode off = expect(200, operator, patch("/api/ops/content-types/SMS"), Map.of("active", false));
            assertThat(off.path("active").asBoolean()).isFalse();
            assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = '콘텐츠 유형 변경' "
                    + "ORDER BY id DESC LIMIT 1", String.class)).isEqualTo("사용 → 중지");
            for (JsonNode ct : getJson(req, "/api/content-types")) {
                if (ct.path("type").asString().equals("SMS")) {
                    assertThat(ct.path("active").asBoolean()).isFalse();
                }
            }
            assertThat(expect(400, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                    .path("message").asString()).isEqualTo("사용 중인 유형만 선택할 수 있습니다");
            expect(400, req, put("/api/requests/" + alimtalk + "/type"), Map.of("type", "SMS"));
            assertThat(getJson(req, "/api/requests/" + existing).path("type").asString()).isEqualTo("SMS");
            // an inactive type is not an unassigned combination
            assertThat(getJson(operator, "/api/ops/customers/" + t.customerId())
                    .path("unassignedDatasetTypes").toString()).doesNotContain("SMS");
            expect(404, operator, patch("/api/ops/content-types/FAX"), Map.of("active", true));
            assertThat(expect(400, operator, patch("/api/ops/content-types/SMS"), Map.of()).path("message")
                    .asString()).isEqualTo("사용 여부를 선택하세요");
        } finally {
            expect(200, operator, patch("/api/ops/content-types/SMS"), Map.of("active", true));
        }
        assertThat(getJson(operator, "/api/ops/content-types").toString()).doesNotContain("\"active\":false");
    }

    @Test
    void sampleRequestsAndTheirCleanupStayInsideTheSampleCustomer() throws Exception {
        Tenant s = newTenant();
        jdbc.update("UPDATE customers SET sample = 1 WHERE id = ?", s.customerId());
        Tenant n = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login sReq = login(s.requester());
        Login nReq = login(n.requester());
        String nDraft = smsDraft(nReq, n.projectId());
        List<String> nBefore = requestIdsOfCustomer(n.customerId());

        String nBase = "/api/ops/customers/" + n.customerId();
        assertThat(expect(409, operator, post(nBase + "/sample-requests"),
                Map.of("projectId", n.projectId(), "type", "SMS")).path("message").asString())
                .isEqualTo("샘플 데이터 작업은 샘플 고객사에서만 가능합니다");
        expect(409, operator, delete(nBase + "/sample-data"), null);

        String sBase = "/api/ops/customers/" + s.customerId();
        assertThat(expect(400, operator, post(sBase + "/sample-requests"), Map.of("type", "SMS")).path("message")
                .asString()).isEqualTo("프로젝트를 선택하세요");
        expect(400, operator, post(sBase + "/sample-requests"), Map.of("projectId", s.projectId()));
        expect(404, operator, post(sBase + "/sample-requests"), Map.of("projectId", n.projectId(), "type", "SMS"));
        JsonNode free = expect(201, operator, post(sBase + "/sample-requests"),
                Map.of("projectId", s.projectId(), "type", "FREEFORM"));
        String freeId = free.path("id").asString();
        assertThat(free.path("title").asString()).isEqualTo("[샘플] 자유입력형 작성 연습");
        assertThat(free.path("status").asString()).isEqualTo("DRAFT");
        JsonNode alim = expect(201, operator, post(sBase + "/sample-requests"),
                Map.of("projectId", s.projectId(), "type", "ALIMTALK"));
        String alimId = alim.path("id").asString();
        assertThat(jdbc.queryForObject("SELECT demo FROM requests WHERE id = ?", Boolean.class, alimId)).isTrue();
        assertThat(jdbc.queryForObject("SELECT requested_by FROM requests WHERE id = ?", Long.class, alimId))
                .isEqualTo(sReq.userId());
        assertThat(jdbc.queryForObject("SELECT payload FROM contents WHERE request_id = ?", String.class, alimId))
                .contains("#{customer_name}님, 샘플 안내 문안입니다.");
        assertThat(jdbc.queryForList("SELECT action FROM request_history WHERE request_id = ? ORDER BY id",
                String.class, alimId)).containsExactly("요청 작성", "샘플 요청 생성");
        // the requester works with the sample like any draft; a clone of a sample is a sample
        String cloneId = expect(201, sReq, post("/api/requests/" + alimId + "/clone"), null).path("id").asString();
        assertThat(jdbc.queryForObject("SELECT demo FROM requests WHERE id = ?", Boolean.class, cloneId)).isTrue();
        JsonNode fileA = read(upload(sReq, "/api/requests/" + freeId + "/contents/C1/files", "a.pdf", PDF, null));
        JsonNode fileB = read(upload(sReq, "/api/requests/" + freeId + "/contents/C1/files", "b.pdf", PDF, null));
        String keyA = jdbc.queryForObject("SELECT storage_key FROM content_file_versions WHERE file_id = ?",
                String.class, fileA.path("id").asLong());
        String keyB = jdbc.queryForObject("SELECT storage_key FROM content_file_versions WHERE file_id = ?",
                String.class, fileB.path("id").asLong());

        // a real request of the sample customer shares object A
        String real = expect(201, sReq, post("/api/requests"), Map.of("projectId", s.projectId(), "type", "FREEFORM"))
                .path("id").asString();
        JsonNode realFile = read(upload(sReq, "/api/requests/" + real + "/contents/C1/files", "r.pdf", PDF, null));
        jdbc.update("UPDATE content_file_versions SET storage_key = ? WHERE file_id = ?", keyA,
                realFile.path("id").asLong());

        JsonNode overview = getJson(operator, sBase + "/sample-requests");
        assertThat(overview.path("sample").asBoolean()).isTrue();
        assertThat(overview.path("samples")).hasSize(3);
        assertThat(overview.path("realRequestCount").asLong()).isEqualTo(1);
        assertThat(getJson(operator, "/api/ops/customers/" + s.customerId()).path("sampleRequestCount")
                .asLong()).isEqualTo(3);

        expect(204, operator, delete(sBase + "/sample-data"), null);
        assertThat(requestIdsOfCustomer(s.customerId())).containsExactly(real);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contents WHERE request_id IN (?, ?, ?)", Integer.class,
                freeId, alimId, cloneId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id IN (?, ?, ?)",
                Integer.class, freeId, alimId, cloneId)).isZero();
        assertThat(storage.exists(keyA)).as("shared object kept").isTrue();
        assertThat(storage.exists(keyB)).as("sample-only object removed").isFalse();
        getJson(sReq, "/api/requests/" + real);
        assertThat(requestIdsOfCustomer(n.customerId())).isEqualTo(nBefore).contains(nDraft);
        assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = '샘플 데이터 초기화' "
                + "AND customer_id = ? ORDER BY id DESC LIMIT 1", String.class, s.customerId()))
                .isEqualTo("샘플 3건 삭제, 운영 데이터 보존");
        assertThat(getJson(operator, "/api/ops/setup-logs?customerId=" + s.customerId()).path("content").get(0)
                .path("result")
                .asString()).isEqualTo("운영 요청 1건은 보존");
    }

    @Test
    void smsSampleRequestHasABlankSender() throws Exception {
        Tenant s = newTenant();
        jdbc.update("UPDATE customers SET sample = 1 WHERE id = ?", s.customerId());
        Login operator = login(JUNG_OPERATOR);
        String id = expect(201, operator, post("/api/ops/customers/" + s.customerId() + "/sample-requests"),
                Map.of("projectId", s.projectId(), "type", "SMS")).path("id").asString();
        // projects register no sender numbers any more, so the sample leaves the optional sender empty
        JsonNode payload = json.readTree(jdbc.queryForObject("SELECT payload FROM contents WHERE request_id = ?",
                String.class, id));
        assertThat(payload.has("sender")).isTrue();
        assertThat(payload.path("sender").asString()).isEmpty();
        assertThat(payload.path("body").asString()).endsWith("샘플 안내 문안입니다.");
    }

    @Test
    void sampleResetRestoresTheSeedAndNeverTouchesOtherCustomers() throws Exception {
        Tenant s = newTenant();
        jdbc.update("UPDATE customers SET sample = 1 WHERE id = ?", s.customerId());
        Tenant n = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login kim = login(KIM_REQUESTER);
        smsDraft(login(s.requester()), s.projectId());
        Login nReq = login(n.requester());
        String nId = smsDraft(nReq, n.projectId());
        expect(200, nReq, post("/api/requests/" + nId + "/submit"), Map.of("rowVersion", rowVersion(nReq, nId)));
        List<String> nBefore = requestIdsOfCustomer(n.customerId());
        int nHistory = jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id = ?", Integer.class,
                nId);
        long c1 = customerId("hanbitcard.co.kr");
        long c2 = customerId("dodamlife.com");
        String extra = expect(201, kim, post("/api/requests"), Map.of("projectId", projectId("카드 혜택 알림"),
                "type", "SMS")).path("id").asString();
        jdbc.update("UPDATE requests SET title = '바뀐 제목' WHERE id = 'REQ-2609-112'");

        JsonNode result = expect(200, operator, post("/api/ops/sample-reset"), null);
        assertThat(result.path("restoredRequests").asInt()).isEqualTo(12);
        assertThat(result.path("deletedRequests").asInt()).isGreaterThanOrEqualTo(12 + 1 + 1);
        assertThat(result.path("customerIds").toString()).contains(String.valueOf(c1), String.valueOf(c2),
                String.valueOf(s.customerId())).doesNotContain(String.valueOf(n.customerId()));

        List<String> seedIds = new ArrayList<>(requestIdsOfCustomer(c1));
        seedIds.addAll(requestIdsOfCustomer(c2));
        assertThat(seedIds).containsExactlyInAnyOrder("REQ-2609-101", "REQ-2609-102", "REQ-2609-103",
                "REQ-2609-104", "REQ-2609-105", "REQ-2609-088", "REQ-2609-106", "REQ-2609-107", "REQ-2609-110",
                "REQ-2609-113", "REQ-2609-111", "REQ-2609-112").doesNotContain(extra);
        assertThat(jdbc.queryForObject("SELECT title FROM requests WHERE id = 'REQ-2609-112'", String.class))
                .isEqualTo("실효 예정 계약 안내");
        assertThat(requestIdsOfCustomer(s.customerId())).isEmpty();
        assertThat(requestIdsOfCustomer(n.customerId())).isEqualTo(nBefore);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id = ?", Integer.class,
                nId)).isEqualTo(nHistory);
        assertThat(jdbc.queryForObject("SELECT status FROM requests WHERE id = ?", String.class, nId))
                .isEqualTo("WAITING");

        JsonNode r101 = getJson(kim, "/api/requests/REQ-2609-101");
        assertThat(r101.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(r101.path("contents")).hasSize(3);
        assertThat(r101.path("contents").get(1).path("lock").path("userId").asLong()).isEqualTo(userId(HAN_REVIEWER));
        assertThat(getJson(kim, "/api/requests/REQ-2609-106").path("bundle").path("items")).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE request_id = 'REQ-2609-104'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_opinions WHERE request_id = 'REQ-2609-101'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = '샘플 초기화' "
                + "AND customer_id IS NULL ORDER BY id DESC LIMIT 1", String.class)).endsWith("실제 고객사 보존");

        // a second reset gives the same seed again
        assertThat(expect(200, operator, post("/api/ops/sample-reset"), null).path("restoredRequests").asInt())
                .isEqualTo(12);
        assertThat(requestIdsOfCustomer(n.customerId())).isEqualTo(nBefore);
    }
}
