package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** 프로젝트 관리 (contract §24): participation of a project, deleting a project without history. */
class ProjectManagementIntegrationTest extends IntegrationTestBase {

    private static Map<String, Object> member(long userId, String... roles) {
        return Map.of("userId", userId, "roles", List.of(roles));
    }

    private static Map<String, Object> members(List<Map<String, Object>> list) {
        return Map.of("members", list);
    }

    private JsonNode manageRow(Login admin, long customerId, long projectId) throws Exception {
        for (JsonNode p : getJson(admin, "/api/customers/" + customerId + "/projects/manage").path("content")) {
            if (p.path("id").asLong() == projectId) {
                return p;
            }
        }
        throw new AssertionError("project " + projectId + " not listed");
    }

    private int audits(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    private String lastAudit(String action, long customerId) {
        return jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = ? AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, action, customerId);
    }

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

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    @Test
    void adminReplacesTheParticipationOfAProject() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        long requesterId = userId(t.requester());
        long requester2Id = userId(t.requester2());
        long reviewerId = userId(t.reviewer());
        long adminId = userId(t.admin());
        long project = expect(201, admin, post("/api/customers/" + t.customerId() + "/projects"),
                Map.of("name", "참여 범위", "leadUserId", reviewerId)).path("id").asLong();
        String url = "/api/projects/" + project + "/members";

        // ---- access
        expect(403, req, put(url), members(List.of(member(reviewerId, "REVIEWER"))));
        expect(404, login(KANG_ADMIN), put(url), members(List.of(member(reviewerId, "REVIEWER"))));
        expect(404, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"), member(userId(KIM_REQUESTER),
                "REQUESTER"))));

        // ---- checks: the lead keeps the reviewer role, requester and reviewer exclude each other, no approver
        // without approval, no duplicate, no deactivated newcomer
        assertThat(expect(400, admin, put(url), members(List.of(member(requesterId, "REQUESTER")))).path("message")
                .asString()).isEqualTo("참여 범위: 대표 검수자의 검수자 역할은 해제할 수 없습니다. 프로젝트 관리에서 대표 검수자를 먼저 바꾸세요");
        assertThat(expect(400, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"),
                member(requesterId, "REQUESTER", "REVIEWER")))).path("message").asString())
                .isEqualTo("요청자와 검수자는 함께 줄 수 없습니다");
        assertThat(expect(400, admin, put(url), members(List.of(member(reviewerId, "REVIEWER", "APPROVER"))))
                .path("message").asString()).isEqualTo("이 고객사는 승인 단계를 쓰지 않습니다");
        assertThat(expect(400, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"),
                member(reviewerId, "REVIEWER")))).path("message").asString()).isEqualTo("같은 사용자를 두 번 보냈습니다");
        jdbc.update("UPDATE users SET active = 0 WHERE id = ?", requester2Id);
        assertThat(expect(400, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"),
                member(requester2Id, "REQUESTER")))).path("message").asString())
                .isEqualTo("비활성 사용자는 프로젝트에 추가할 수 없습니다");
        assertThat(audits("프로젝트 구성원 변경", t.customerId())).isZero();

        // ---- the whole list: added with their roles, others removed
        JsonNode saved = expect(200, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"),
                member(requesterId, "REQUESTER"), member(adminId, "REQUESTER"))));
        assertThat(saved.path("members")).hasSize(3);
        assertThat(lastAudit("프로젝트 구성원 변경", t.customerId()))
                .isEqualTo("사용자 req: 없음 → 요청자 / 사용자 admin: 없음 → 요청자");
        JsonNode trimmed = expect(200, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"),
                member(requesterId, "REQUESTER"))));
        assertThat(trimmed.path("members")).hasSize(2);
        assertThat(lastAudit("프로젝트 구성원 변경", t.customerId())).isEqualTo("사용자 admin: 요청자 → 없음");
        // nothing changed: no audit
        expect(200, admin, put(url), members(List.of(member(reviewerId, "REVIEWER"), member(requesterId, "REQUESTER"))));
        assertThat(audits("프로젝트 구성원 변경", t.customerId())).isEqualTo(2);
    }

    @Test
    void theRequesterOfARequestInProgressKeepsTheRole() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        long requesterId = userId(t.requester());
        String id = submitted(req, t.projectId());
        String message = "작성 테스트 " + "";
        List<Map<String, Object>> withoutRequester = new ArrayList<>();
        for (JsonNode m : getJson(admin, "/api/projects/" + t.projectId()).path("members")) {
            if (m.path("userId").asLong() != requesterId) {
                List<String> roles = new ArrayList<>();
                m.path("roles").forEach(r -> roles.add(r.asString()));
                withoutRequester.add(Map.of("userId", m.path("userId").asLong(), "roles", roles));
            }
        }
        String refused = expect(400, admin, put("/api/projects/" + t.projectId() + "/members"),
                members(withoutRequester)).path("message").asString();
        assertThat(refused).startsWith(message).endsWith(
                ": 진행 중인 요청의 요청자라 요청자 역할을 해제할 수 없습니다. 요청을 완료하거나 취소한 뒤 해제하세요");
        // the user-centred role edit applies the same rule
        assertThat(expect(400, admin, put("/api/customers/" + t.customerId() + "/users/" + requesterId
                + "/project-roles"), Map.of("projects", List.of(Map.of("projectId", t.projectId(), "roles", List.of()))))
                .path("message").asString()).isEqualTo(refused);

        expect(200, req, post("/api/requests/" + id + "/cancel"), Map.of("rowVersion", rowVersion(req, id)));
        JsonNode saved = expect(200, admin, put("/api/projects/" + t.projectId() + "/members"),
                members(withoutRequester));
        assertThat(saved.path("members")).hasSize(withoutRequester.size());
    }

    @Test
    void anApprovalCustomerKeepsAnApprover() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        long leadId = userId(t.lead());
        long reviewerId = userId(t.reviewer());
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'APPROVER')",
                t.projectId(), reviewerId);
        String url = "/api/projects/" + t.projectId() + "/members";
        List<Map<String, Object>> noApprover = List.of(member(userId(t.requester()), "REQUESTER"),
                member(userId(t.requester2()), "REQUESTER"), member(leadId, "REVIEWER"), member(reviewerId, "REVIEWER"));
        assertThat(expect(400, admin, put(url), members(noApprover)).path("message").asString())
                .isEqualTo("승인자를 한 명 이상 지정하세요");
        // moving the approver role to another user at once is fine
        List<Map<String, Object>> moved = List.of(member(userId(t.requester()), "REQUESTER"),
                member(userId(t.requester2()), "REQUESTER"), member(leadId, "REVIEWER", "APPROVER"),
                member(reviewerId, "REVIEWER"));
        JsonNode saved = expect(200, admin, put(url), members(moved));
        assertThat(saved.path("members").toString()).contains("APPROVER");
    }

    @Test
    void onlyAProjectWithoutHistoryIsDeleted() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        long reviewerId = userId(t.reviewer());
        String base = "/api/customers/" + t.customerId();

        // the tenant's project has a variable: kept; the only project is never deletable
        assertThat(manageRow(admin, t.customerId(), t.projectId()).path("deletable").asBoolean()).isFalse();
        assertThat(expect(409, admin, delete("/api/projects/" + t.projectId()), null).path("message").asString())
                .isEqualTo("고객사의 마지막 프로젝트는 삭제할 수 없습니다");
        assertThat(getJson(admin, "/api/projects/" + t.projectId()).has("deletable")).isFalse();

        long empty = expect(201, admin, post(base + "/projects"), Map.of("name", "빈 프로젝트", "leadUserId",
                reviewerId)).path("id").asLong();
        long noticed = expect(201, admin, post(base + "/projects"), Map.of("name", "공지 프로젝트", "leadUserId",
                reviewerId)).path("id").asLong();
        expect(201, admin, post(base + "/notices"), Map.of("scope", "PROJECT", "projectId", noticed, "title", "공지",
                "body", "본문"));
        assertThat(manageRow(admin, t.customerId(), empty).path("deletable").asBoolean()).isTrue();
        assertThat(manageRow(admin, t.customerId(), noticed).path("deletable").asBoolean()).isFalse();
        String kept = "요청·공지·변수 이력이 있는 프로젝트는 삭제할 수 없습니다. 사용 중지로 보존하세요";
        assertThat(expect(409, admin, delete("/api/projects/" + t.projectId()), null).path("message").asString())
                .isEqualTo(kept);
        assertThat(expect(409, admin, delete("/api/projects/" + noticed), null).path("message").asString())
                .isEqualTo(kept);

        expect(403, req, delete("/api/projects/" + empty), null);
        expect(404, login(KANG_ADMIN), delete("/api/projects/" + empty), null);
        expect(204, admin, delete("/api/projects/" + empty), null);
        expect(404, admin, delete("/api/projects/" + empty), null);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM project_members WHERE project_id = ?", Integer.class,
                empty)).isZero();
        assertThat(lastAudit("프로젝트 삭제", t.customerId())).isNull();
        assertThat(audits("프로젝트 삭제", t.customerId())).isEqualTo(1);
        expect(404, admin, get("/api/projects/" + empty), null);
    }
}
