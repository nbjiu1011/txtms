package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** Temporary sign-up (demo mode): options, every role, validation order, duplicates and the audit record. */
class SignupIntegrationTest extends IntegrationTestBase {

    private static final String PASSWORD = "Signup!2026";

    private MvcResult signup(Map<String, Object> body) throws Exception {
        return mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andReturn();
    }

    private static Map<String, Object> body(String email, String role, Long customerId, Long projectId) {
        Map<String, Object> b = new HashMap<>();
        b.put("name", "가입 " + role);
        b.put("email", email);
        b.put("password", PASSWORD);
        b.put("role", role);
        b.put("customerId", customerId);
        b.put("projectId", projectId);
        return b;
    }

    private static String unique(String prefix) {
        return prefix + "-" + System.nanoTime() + "@signup.test";
    }

    private void assertField(MvcResult result, String field, String message) throws Exception {
        assertThat(result.getResponse().getStatus()).as(field).isEqualTo(400);
        JsonNode error = read(result);
        assertThat(error.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(error.path("message").asString()).isEqualTo(message);
        assertThat(error.path("fieldErrors").get(0).path("field").asString()).isEqualTo(field);
        assertThat(error.path("fieldErrors").get(0).path("message").asString()).isEqualTo(message);
    }

    @Test
    void optionsListActiveCustomersWithTheirProjectsAndLeads() throws Exception {
        Tenant t = newTenant();
        JsonNode customers = read(mvc.perform(get("/api/auth/signup-options")).andReturn()).path("customers");
        JsonNode hanbit = null;
        JsonNode mine = null;
        for (JsonNode c : customers) {
            if ("한빛카드".equals(c.path("name").asString())) {
                hanbit = c;
            }
            if (c.path("id").asLong() == t.customerId()) {
                mine = c;
            }
        }
        assertThat(hanbit).isNotNull();
        assertThat(hanbit.path("projects").findValuesAsString("name")).contains("카드 혜택 알림");
        assertThat(mine.path("approvalEnabled").asBoolean()).isFalse();
        assertThat(mine.path("projects")).hasSize(1);
        assertThat(mine.path("projects").get(0).path("leadName").asString()).isEqualTo("사용자 lead");

        jdbc.update("UPDATE customers SET active = 0 WHERE id = ?", t.customerId());
        JsonNode after = read(mvc.perform(get("/api/auth/signup-options")).andReturn()).path("customers");
        List<Long> ids = new java.util.ArrayList<>();
        after.forEach(c -> ids.add(c.path("id").asLong()));
        assertThat(ids).doesNotContain(t.customerId());
    }

    @Test
    void projectRoleSignupLogsInAndWritesTheAudit() throws Exception {
        Tenant t = newTenant();
        String email = unique("Reviewer");
        MvcResult result = signup(body(email, "REVIEWER", t.customerId(), t.projectId()));
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        Login login = toLogin(result);
        assertThat(login.refreshCookie()).isNotNull();
        assertThat(login.me().path("email").asString()).isEqualTo(email.toLowerCase());
        assertThat(login.me().path("customerId").asLong()).isEqualTo(t.customerId());
        assertThat(login.me().path("demo").asBoolean()).as("no persona switcher").isFalse();
        JsonNode membership = login.me().path("memberships").get(0);
        assertThat(membership.path("projectId").asLong()).isEqualTo(t.projectId());
        assertThat(membership.path("roles").get(0).asString()).isEqualTo("REVIEWER");

        // the account works with email and password afterwards
        assertThat(login(email, PASSWORD, false).userId()).isEqualTo(login.userId());
        assertThat(jdbc.queryForObject("SELECT demo FROM users WHERE id = ?", Boolean.class, login.userId())).isTrue();
        List<Map<String, Object>> audit = jdbc.queryForList(
                "SELECT actor_id, customer_id, detail FROM audit_logs WHERE action = '임시 가입' AND actor_id = ?",
                login.userId());
        assertThat(audit).hasSize(1);
        assertThat(((Number) audit.getFirst().get("customer_id")).longValue()).isEqualTo(t.customerId());
        assertThat(audit.getFirst().get("detail").toString()).contains("검수자").contains(email.toLowerCase());
    }

    @Test
    void leadReviewerTakesOverTheProjectAndTheFormerLeadStaysReviewer() throws Exception {
        Tenant t = newTenant();
        long formerLead = userId(t.lead());
        Login login = toLogin(signup(body(unique("lead"), "LEAD_REVIEWER", t.customerId(), t.projectId())));
        assertThat(jdbc.queryForObject("SELECT lead_user_id FROM projects WHERE id = ?", Long.class, t.projectId()))
                .isEqualTo(login.userId());
        JsonNode membership = login.me().path("memberships").get(0);
        assertThat(membership.path("lead").asBoolean()).isTrue();
        assertThat(membership.path("roles").get(0).asString()).isEqualTo("REVIEWER");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM project_members WHERE project_id = ? AND user_id = ? "
                + "AND role = 'REVIEWER'", Integer.class, t.projectId(), formerLead)).isEqualTo(1);
    }

    @Test
    void approverNeedsACustomerThatUsesApproval() throws Exception {
        Tenant t = newTenant();
        assertField(signup(body(unique("appr"), "APPROVER", t.customerId(), t.projectId())), "role",
                "이 고객사는 승인 단계를 쓰지 않습니다");
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        Login login = toLogin(signup(body(unique("appr"), "APPROVER", t.customerId(), t.projectId())));
        assertThat(login.me().path("memberships").get(0).path("roles").get(0).asString()).isEqualTo("APPROVER");
    }

    @Test
    void customerAdminAndOperatorNeedNoProject() throws Exception {
        Tenant t = newTenant();
        Login admin = toLogin(signup(body(unique("admin"), "CUSTOMER_ADMIN", t.customerId(), null)));
        assertThat(admin.me().path("adminCustomerIds").get(0).asLong()).isEqualTo(t.customerId());
        assertThat(admin.me().path("memberships")).isEmpty();
        assertThat(getAs(admin, "/api/customers/" + t.customerId() + "/members").andReturn().getResponse()
                .getStatus()).isEqualTo(200);

        Login operator = toLogin(signup(body(unique("ops"), "OPERATOR", t.customerId(), t.projectId())));
        assertThat(operator.me().path("operator").asBoolean()).isTrue();
        assertThat(operator.me().path("customerId").isNull()).isTrue();
        assertThat(getAs(operator, "/api/ops/customers").andReturn().getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void fieldsAreCheckedInOrderAndEmailsAreUnique() throws Exception {
        Tenant t = newTenant();
        Tenant other = newTenant();
        Map<String, Object> ok = body(unique("order"), "REQUESTER", t.customerId(), t.projectId());

        Map<String, Object> b = new HashMap<>(ok);
        b.put("name", " ");
        assertField(signup(b), "name", "이름을(를) 입력하세요");
        b = new HashMap<>(ok);
        b.put("email", "not-an-email");
        assertField(signup(b), "email", "이메일 형식을 확인하세요");
        b = new HashMap<>(ok);
        b.put("password", "short");
        assertField(signup(b), "password", "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다");
        b = new HashMap<>(ok);
        b.put("role", null);
        assertField(signup(b), "role", "역할을 선택하세요");
        b = new HashMap<>(ok);
        b.put("customerId", null);
        assertField(signup(b), "customerId", "고객사를 선택하세요");
        b = new HashMap<>(ok);
        b.put("projectId", other.projectId());
        assertField(signup(b), "projectId", "프로젝트를 선택하세요");
        jdbc.update("UPDATE projects SET active = 0 WHERE id = ?", other.projectId());
        b = new HashMap<>(ok);
        b.put("customerId", other.customerId());
        b.put("projectId", other.projectId());
        assertField(signup(b), "projectId", "프로젝트를 선택하세요");

        b = new HashMap<>(ok);
        b.put("email", KIM_REQUESTER.toUpperCase());
        MvcResult duplicate = signup(b);
        assertThat(duplicate.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(duplicate).path("code").asString()).isEqualTo("DUPLICATE");
        assertThat(read(duplicate).path("message").asString()).isEqualTo("이미 가입된 이메일입니다");

        assertThat(signup(ok).getResponse().getStatus()).isEqualTo(200);
    }
}
