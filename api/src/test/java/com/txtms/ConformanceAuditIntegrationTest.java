package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Requirement-conformance probes: authorization on every
 * request endpoint (other tenant 404, operator 404, same-customer non-member 403, someone else's draft
 * DRAFT_PRIVATE), invalid state transitions, round rules, error hygiene, refresh CSRF posture, token single use,
 * paging caps and Phase 2 features not being exposed. Every scenario runs on its own tenant.
 */
class ConformanceAuditIntegrationTest extends IntegrationTestBase {

    // ------------------------------------------------------------------ helpers

    private long addUser(Tenant t, String local, String role) {
        String domain = t.requester().substring(t.requester().indexOf('@') + 1);
        String email = local + "@" + domain;
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

    private String draft(Login req, Tenant t, String type, String title) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", type))
                .path("id").asString();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", title);
        info.put("hopeDueDate", "2026-12-20");
        info.put("purpose", "안내");
        info.put("target", "전체 회원");
        info.put("background", "정기 발송");
        expect(200, req, patch("/api/requests/" + id), info);
        return id;
    }

    private String smsDraft(Login req, Tenant t, String title, String body) throws Exception {
        String id = draft(req, t, "SMS", title);
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload",
                Map.of("sender", "1588-0000", "body", body, "customerCenter", false, "optOut", false)));
        return id;
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private void submit(Login req, String id) throws Exception {
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
    }

    private void assign(Login lead, String id, List<Long> reviewers, long primary) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", reviewers);
        body.put("primaryReviewerId", primary);
        body.put("dueDate", "2026-12-15");
        body.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, post("/api/requests/" + id + "/assignment"), body);
    }

    private JsonNode status(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id);
    }

    private static String code(MvcResult result) throws Exception {
        String body = text(result);
        return body.isEmpty() ? "" : JSON_CODE.matcher(body).results().map(m -> m.group(1)).findFirst().orElse("");
    }

    private static final java.util.regex.Pattern JSON_CODE = java.util.regex.Pattern.compile("\"code\"\\s*:\\s*\"(\\w+)\"");

    /** Asserts status and error code; the body never leaks server internals. */
    private void assertError(MvcResult result, int status, String errorCode, String what) throws Exception {
        assertThat(result.getResponse().getStatus()).as(what + " status, body " + text(result)).isEqualTo(status);
        assertThat(code(result)).as(what + " code").isEqualTo(errorCode);
        assertThat(text(result)).as(what + " leaks no internals").doesNotContain("Exception", "at com.", "java.");
    }

    /** One endpoint call: method + url + JSON body (null = none). */
    private record Call(String label, MockHttpServletRequestBuilder builder, Object body) {
    }

    private static MockHttpServletRequestBuilder builder(String method, String url) {
        return switch (method) {
            case "GET" -> get(url);
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "PATCH" -> patch(url);
            case "DELETE" -> delete(url);
            default -> throw new IllegalArgumentException(method);
        };
    }

    private MvcResult call(Login login, String method, String url, Object body) throws Exception {
        return send(login, builder(method, url), body);
    }

    private MvcResult multipart(Login login, String url) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.multipart(url)
                .file(new MockMultipartFile("file", "a.txt", "text/plain", "hello".getBytes(StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + login.accessToken())).andReturn();
    }

    /** Every request-scoped endpoint with a plausible body (rowVersion 1; authorization is checked first). */
    private static List<String[]> requestEndpoints(String id) {
        String r = "/api/requests/" + id;
        return List.of(
                new String[] {"GET", r},
                new String[] {"GET", r + "/history"},
                new String[] {"GET", r + "/assignment-changes"},
                new String[] {"GET", r + "/locks"},
                new String[] {"GET", r + "/contents/C1/versions/1"},
                new String[] {"GET", r + "/contents/C1/files/1/versions/1/download"},
                new String[] {"GET", r + "/images/img_0000000000000000"},
                new String[] {"GET", r + "/corrections/dataset"},
                new String[] {"GET", r + "/bundle/export.xlsx"},
                new String[] {"GET", r + "/bundle/attachments.zip"},
                new String[] {"POST", r + "/bundle/copy-events"},
                new String[] {"POST", r + "/corrections/check"},
                new String[] {"POST", r + "/corrections/events"},
                new String[] {"POST", r + "/corrections/suggestions"},
                new String[] {"PATCH", r},
                new String[] {"PUT", r + "/type"},
                new String[] {"POST", r + "/clone"},
                new String[] {"POST", r + "/follow-up"},
                new String[] {"POST", r + "/submit"},
                new String[] {"POST", r + "/submit-check"},
                new String[] {"POST", r + "/cancel"},
                new String[] {"POST", r + "/contents"},
                new String[] {"PUT", r + "/contents/C1"},
                new String[] {"DELETE", r + "/contents/C1"},
                new String[] {"PATCH", r + "/contents/C1/files/1"},
                new String[] {"DELETE", r + "/contents/C1/files/1"},
                new String[] {"POST", r + "/bulk-import/commit"},
                new String[] {"POST", r + "/assignment"},
                new String[] {"PUT", r + "/assignment"},
                new String[] {"PATCH", r + "/schedule"},
                new String[] {"POST", r + "/opinions"},
                new String[] {"POST", r + "/asks"},
                new String[] {"POST", r + "/asks/1/answer"},
                new String[] {"POST", r + "/recall"},
                new String[] {"POST", r + "/recall/decision"},
                new String[] {"POST", r + "/contents/C1/lock"},
                new String[] {"DELETE", r + "/contents/C1/lock"},
                new String[] {"POST", r + "/contents/C1/lock/force-release"},
                new String[] {"POST", r + "/contents/C1/revisions"},
                new String[] {"POST", r + "/complete"},
                new String[] {"POST", r + "/approve"},
                new String[] {"POST", r + "/revise"});
    }

    private static Object bodyFor(String method, String url) {
        if (method.equals("GET") || method.equals("DELETE")) {
            return null;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rowVersion", 1);
        if (url.endsWith("/corrections/check")) {
            return Map.of("contents", List.of(Map.of("contentKey", "C1", "payload", Map.of())));
        }
        if (url.endsWith("/contents/C1")) {
            return Map.of("payload", Map.of());
        }
        body.put("contentKey", "C1");
        return body;
    }

    /** Every request endpoint answers {@code status/code} for the user, and the multipart uploads too. */
    private void assertEveryEndpoint(Login login, String id, int status, String errorCode, String who)
            throws Exception {
        for (String[] e : requestEndpoints(id)) {
            MvcResult result = call(login, e[0], e[1], bodyFor(e[0], e[1]));
            assertError(result, status, errorCode, who + " " + e[0] + " " + e[1]);
        }
        String r = "/api/requests/" + id;
        for (String url : List.of(r + "/contents/C1/files", r + "/contents/C1/files/1/versions",
                r + "/contents/C1/images", r + "/bulk-import/preview")) {
            assertError(multipart(login, url), status, errorCode, who + " upload " + url);
        }
    }

    // ------------------------------------------------------------------ authorization

    @Test
    void draftPrivacyCoversEverySubResource() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login req2 = login(t.requester2());
        Login admin = login(t.admin());
        Login lead = login(t.lead());
        Login operator = login(JUNG_OPERATOR);
        Login outsider = login(newTenant().requester());
        String id = smsDraft(req, t, "작성 중 비공개", "본문");

        assertThat(status(req, id).path("status").asString()).isEqualTo("DRAFT");
        // same customer, not the author (another requester, the lead, the customer admin): DRAFT_PRIVATE everywhere
        assertEveryEndpoint(req2, id, 403, "DRAFT_PRIVATE", "other requester");
        assertEveryEndpoint(lead, id, 403, "DRAFT_PRIVATE", "lead");
        assertEveryEndpoint(admin, id, 403, "DRAFT_PRIVATE", "admin");
        // other customers and operators: existence is never revealed
        assertEveryEndpoint(outsider, id, 404, "NOT_FOUND", "other tenant");
        assertEveryEndpoint(operator, id, 404, "NOT_FOUND", "operator");

        // lists, counts and dashboards never include someone else's draft
        JsonNode list = getJson(req2, "/api/requests?projectId=" + t.projectId() + "&size=100");
        assertThat(list.path("content").toString()).doesNotContain(id);
        assertThat(list.path("page").path("totalElements").asInt()).isZero();
        JsonNode customerList = getJson(admin, "/api/requests?customerId=" + t.customerId() + "&size=100");
        assertThat(customerList.path("page").path("totalElements").asInt()).isZero();
        assertThat(getJson(lead, "/api/projects/" + t.projectId() + "/dashboard").path("pipelineTotal").asInt())
                .isZero();
        assertThat(getJson(req, "/api/projects/" + t.projectId() + "/dashboard").path("pipelineTotal").asInt())
                .isEqualTo(1);
        // the author still sees it
        assertThat(getJson(req, "/api/requests/" + id + "/history")).isNotEmpty();
    }

    @Test
    void submittedRequestsAreClosedToOtherTenantsOperatorsAndNonMembers() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        addUser(t, "nomember", null);
        Login nonMember = login(email(t, "nomember"));
        Login operator = login(JUNG_OPERATOR);
        Login outsider = login(newTenant().admin());
        String id = smsDraft(req, t, "검수 중 권한", "본문");
        submit(req, id);
        assign(lead, id, List.of(rev.userId()), rev.userId());

        // same customer but not a project member: FORBIDDEN on every endpoint (reads and writes)
        assertEveryEndpoint(nonMember, id, 403, "FORBIDDEN", "non-member");
        // other customers (even their admin) and the operator: NOT_FOUND
        assertEveryEndpoint(outsider, id, 404, "NOT_FOUND", "other tenant admin");
        assertEveryEndpoint(operator, id, 404, "NOT_FOUND", "operator");
        // the request is untouched
        JsonNode detail = status(req, id);
        assertThat(detail.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(detail.path("historyCount").asInt()).isEqualTo(
                jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id = ?", Integer.class, id));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id = ? AND actor_id IN "
                + "(?, ?, ?)", Integer.class, id, nonMember.userId(), operator.userId(), outsider.userId())).isZero();

        // project-level reads follow the same rule
        assertError(getAs(nonMember, "/api/projects/" + t.projectId() + "/dashboard").andReturn(), 404, "NOT_FOUND",
                "non-member dashboard");
        assertError(getAs(nonMember, "/api/archive/contents?projectId=" + t.projectId()).andReturn(), 404,
                "NOT_FOUND", "non-member archive");
        assertError(getAs(outsider, "/api/projects/" + t.projectId() + "/variables").andReturn(), 404, "NOT_FOUND",
                "other tenant variables");
        assertError(getAs(operator, "/api/archive/contents?projectId=" + t.projectId()).andReturn(), 404,
                "NOT_FOUND", "operator archive");
    }

    @Test
    void inactiveAccountsAndCustomersLoseAccessImmediately() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login rev = login(t.reviewer());
        String id = smsDraft(req, t, "비활성 확인", "본문");
        jdbc.update("UPDATE users SET active = 0 WHERE email = ?", t.reviewer());
        MvcResult inactive = getAs(rev, "/api/requests?projectId=" + t.projectId()).andReturn();
        assertError(inactive, 401, "UNAUTHENTICATED", "inactive user");
        jdbc.update("UPDATE customers SET active = 0 WHERE id = ?", t.customerId());
        assertError(getAs(req, "/api/requests/" + id).andReturn(), 401, "UNAUTHENTICATED", "inactive customer");
        MvcResult relogin = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", t.requester(), "password", DEMO_PASSWORD))))
                .andReturn();
        assertError(relogin, 401, "UNAUTHENTICATED", "login of an inactive customer");
        jdbc.update("UPDATE customers SET active = 1 WHERE id = ?", t.customerId());
    }

    // ------------------------------------------------------------------ state transitions and rounds

    @Test
    void invalidTransitionsAreRejectedWithAStateConflict() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        String id = smsDraft(req, t, "상태 전이", "본문");
        String r = "/api/requests/" + id;

        // DRAFT: no cancel, recall, assignment, completion, approval, schedule
        for (String[] e : List.of(new String[] {"POST", r + "/cancel"}, new String[] {"POST", r + "/recall"},
                new String[] {"POST", r + "/complete"}, new String[] {"POST", r + "/approve"},
                new String[] {"PATCH", r + "/schedule"}, new String[] {"POST", r + "/contents/C1/lock"},
                new String[] {"POST", r + "/follow-up"})) {
            assertError(call(req, e[0], e[1], Map.of("rowVersion", rowVersion(req, id), "reason", "x",
                    "dueDate", "2026-12-01")), 409, "REQUEST_STATE_CONFLICT", "DRAFT " + e[1]);
        }

        submit(req, id);
        // WAITING: no second submit, no edits, no recall, no review actions; the lead cannot "change" yet
        assertError(call(req, "POST", r + "/submit", Map.of("rowVersion", rowVersion(req, id))), 409,
                "REQUEST_STATE_CONFLICT", "WAITING submit again");
        assertError(call(req, "PATCH", r, Map.of("title", "x")), 409, "REQUEST_STATE_CONFLICT", "WAITING edit");
        assertError(call(req, "POST", r + "/recall", Map.of("reason", "x", "rowVersion", rowVersion(req, id))), 409,
                "REQUEST_STATE_CONFLICT", "WAITING recall");
        assertError(call(lead, "PUT", r + "/assignment", Map.of("reviewerIds", List.of(rev.userId()), "reason",
                "x", "handover", "y", "rowVersion", rowVersion(lead, id))), 409, "REQUEST_STATE_CONFLICT",
                "WAITING change");
        assertError(call(lead, "POST", r + "/opinions", Map.of("body", "x", "rowVersion", rowVersion(lead, id))),
                409, "REQUEST_STATE_CONFLICT", "WAITING opinion");

        assign(lead, id, List.of(rev.userId()), rev.userId());
        // IN_REVIEW: no cancel (only recall), no first assignment, no approval in a customer without approval
        assertError(call(req, "POST", r + "/cancel", Map.of("rowVersion", rowVersion(req, id))), 409,
                "REQUEST_STATE_CONFLICT", "IN_REVIEW cancel");
        assertError(call(lead, "POST", r + "/assignment", Map.of("reviewerIds", List.of(rev.userId()),
                "dueDate", "2026-12-01", "rowVersion", rowVersion(lead, id))), 409, "REQUEST_STATE_CONFLICT",
                "IN_REVIEW assign");
        assertError(call(admin, "POST", r + "/approve", Map.of("rowVersion", rowVersion(admin, id))), 409,
                "REQUEST_STATE_CONFLICT", "IN_REVIEW approve");
        assertError(call(admin, "POST", r + "/complete", Map.of("rowVersion", rowVersion(admin, id))), 409,
                "REQUEST_STATE_CONFLICT", "admin cannot complete");
        assertError(call(req, "PUT", r + "/contents/C1", Map.of("payload", Map.of())), 409,
                "REQUEST_STATE_CONFLICT", "requester cannot edit in review");

        expect(200, rev, post(r + "/asks"), Map.of("question", "확인 부탁", "rowVersion", rowVersion(rev, id)));
        // CONFIRMING: the whole review pauses; no recall, no change, no completion, no second question
        assertError(call(req, "POST", r + "/recall", Map.of("reason", "x", "rowVersion", rowVersion(req, id))), 409,
                "REQUEST_STATE_CONFLICT", "CONFIRMING recall");
        assertError(call(lead, "PUT", r + "/assignment", Map.of("reviewerIds", List.of(lead.userId()), "reason",
                "x", "handover", "y", "rowVersion", rowVersion(lead, id))), 409, "REQUEST_STATE_CONFLICT",
                "CONFIRMING change");
        assertError(call(rev, "POST", r + "/complete", Map.of("rowVersion", rowVersion(rev, id))), 409,
                "REQUEST_STATE_CONFLICT", "CONFIRMING complete");
        assertError(call(rev, "POST", r + "/asks", Map.of("question", "또", "rowVersion", rowVersion(rev, id))), 409,
                "REQUEST_STATE_CONFLICT", "CONFIRMING ask again");
        assertError(call(rev, "POST", r + "/contents/C1/lock", null), 409, "REQUEST_STATE_CONFLICT",
                "reviewer cannot edit while confirming");
        long askId = status(req, id).path("asks").get(0).path("id").asLong();
        expect(200, req, post(r + "/asks/" + askId + "/answer"), Map.of("answer", "네", "rowVersion",
                rowVersion(req, id)));
        assertError(call(req, "POST", r + "/asks/" + askId + "/answer", Map.of("answer", "또",
                "rowVersion", rowVersion(req, id))), 409, "REQUEST_STATE_CONFLICT", "answer twice");

        expect(200, rev, post(r + "/complete"), Map.of("rowVersion", rowVersion(rev, id)));
        assertThat(status(req, id).path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        // final: nothing changes the completed original
        for (String[] e : List.of(new String[] {"PATCH", r + "/schedule"}, new String[] {"POST", r + "/recall"},
                new String[] {"POST", r + "/submit"}, new String[] {"POST", r + "/asks"},
                new String[] {"POST", r + "/opinions"}, new String[] {"POST", r + "/complete"},
                new String[] {"POST", r + "/contents/C1/lock"})) {
            assertError(call(admin, e[0], e[1], Map.of("rowVersion", rowVersion(admin, id), "reason", "x",
                    "dueDate", "2026-12-01", "question", "q", "body", "b")), 409, "REQUEST_STATE_CONFLICT",
                    "final (admin) " + e[1]);
            assertError(call(req, e[0], e[1], Map.of("rowVersion", rowVersion(req, id), "reason", "x",
                    "dueDate", "2026-12-01", "question", "q", "body", "b")), 409, "REQUEST_STATE_CONFLICT",
                    "final (requester) " + e[1]);
        }
        assertError(call(req, "PATCH", r, Map.of("title", "x")), 409, "REQUEST_STATE_CONFLICT", "final edit");
    }

    @Test
    void roundsFollowThePlanTable() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String id = smsDraft(req, t, "검수 차수", "본문");
        String r = "/api/requests/" + id;

        // cancel before assignment and submit again: round kept (plan §22 "배정 전 취소 후 재요청 유지")
        submit(req, id);
        expect(200, req, post(r + "/cancel"), Map.of("rowVersion", rowVersion(req, id)));
        assertThat(status(req, id).path("nextSubmitRound").asInt()).isEqualTo(1);
        submit(req, id);
        assertThat(status(req, id).path("round").asInt()).isEqualTo(1);
        assign(lead, id, List.of(rev.userId()), rev.userId());

        // reviewer revision: version +1, round kept
        expect(200, rev, post(r + "/contents/C1/lock"), null);
        expect(200, rev, post(r + "/contents/C1/revisions"), Map.of("baseVersion", 1, "payload",
                Map.of("sender", "1588-0000", "body", "검수자 수정", "customerCenter", false, "optOut", false)));
        JsonNode afterRevision = status(req, id);
        assertThat(afterRevision.path("round").asInt()).isEqualTo(1);
        assertThat(afterRevision.path("contents").get(0).path("version").asInt()).isEqualTo(2);

        // question + explanation-only answer: round kept
        expect(200, rev, post(r + "/asks"), Map.of("question", "q1", "rowVersion", rowVersion(rev, id)));
        long ask1 = status(req, id).path("asks").get(0).path("id").asLong();
        expect(200, req, post(r + "/asks/" + ask1 + "/answer"), Map.of("answer", "설명만", "rowVersion",
                rowVersion(req, id)));
        assertThat(status(req, id).path("round").asInt()).isEqualTo(1);

        // question + answer with an edited text: round + 1
        expect(200, rev, post(r + "/asks"), Map.of("question", "q2", "rowVersion", rowVersion(rev, id)));
        expect(200, req, post(r + "/contents/C1/lock"), null);
        expect(200, req, post(r + "/contents/C1/revisions"), Map.of("baseVersion", 2, "payload",
                Map.of("sender", "1588-0000", "body", "요청자 수정", "customerCenter", false, "optOut", false)));
        long ask2 = status(req, id).path("asks").get(1).path("id").asLong();
        expect(200, req, post(r + "/asks/" + ask2 + "/answer"), Map.of("answer", "고쳤습니다", "rowVersion",
                rowVersion(req, id)));
        assertThat(status(req, id).path("round").asInt()).isEqualTo(2);

        // recall approved and resubmitted: round + 1 on the resubmission only
        expect(200, req, post(r + "/recall"), Map.of("reason", "다시 작성", "rowVersion", rowVersion(req, id)));
        expect(200, rev, post(r + "/recall/decision"), Map.of("approve", true, "comment", "승인",
                "rowVersion", rowVersion(rev, id)));
        JsonNode recalled = status(req, id);
        assertThat(recalled.path("status").asString()).isEqualTo("DRAFT");
        assertThat(recalled.path("round").asInt()).isEqualTo(2);
        assertThat(recalled.path("nextSubmitRound").asInt()).isEqualTo(3);
        assertThat(recalled.path("reviewerIds")).isEmpty();
        submit(req, id);
        assertThat(status(req, id).path("round").asInt()).isEqualTo(3);
        // repeated history keeps the round of each entry
        List<Integer> rounds = jdbc.queryForList("SELECT round FROM request_history WHERE request_id = ? AND "
                + "action = '검수 요청' ORDER BY id", Integer.class, id);
        assertThat(rounds).containsExactly(1, 1, 3);
    }

    // ------------------------------------------------------------------ error hygiene and input limits

    @Test
    void malformedRequestsAreClientErrorsWithoutInternals() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = draft(req, t, "FREEFORM", "오류 응답");
        String files = "/api/requests/" + id + "/contents/C1/files";

        // a file endpoint without the file part, or without a multipart body at all
        MvcResult noPart = mvc.perform(MockMvcRequestBuilders.multipart(files)
                .file(new MockMultipartFile("other", "a.txt", "text/plain", "x".getBytes()))
                .header("Authorization", "Bearer " + req.accessToken())).andReturn();
        assertError(noPart, 400, "FILE_REJECTED", "missing file part");
        assertError(send(req, post(files), Map.of("file", "x")), 400, "FILE_REJECTED", "JSON to an upload");
        assertError(send(req, post("/api/requests/" + id + "/bulk-import/preview"), null), 400, "FILE_REJECTED",
                "bulk preview without a file");

        // over-long login input is invalid input, never a server error (the failure counter key is 255 chars)
        String longEmail = "a".repeat(300) + "@example.com";
        MvcResult longLogin = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", longEmail, "password", "x")))).andReturn();
        assertError(longLogin, 400, "VALIDATION_FAILED", "over-long email");
        MvcResult longPassword = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", t.requester(), "password", "p".repeat(5000)))))
                .andReturn();
        assertError(longPassword, 400, "VALIDATION_FAILED", "over-long password");
        MvcResult longReset = mvc.perform(post("/api/auth/password-reset-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", longEmail)))).andReturn();
        assertError(longReset, 400, "VALIDATION_FAILED", "over-long reset email");
        login(t.requester()); // the account is not locked by those calls

        // malformed JSON, wrong types, unknown enum values
        assertError(send(req, patch("/api/requests/" + id), "{not json"), 400, "VALIDATION_FAILED", "bad JSON");
        assertError(send(req, put("/api/requests/" + id + "/type"), Map.of("type", "FAX")), 400,
                "VALIDATION_FAILED", "unknown type");
        assertError(getAs(req, "/api/requests?projectId=abc").andReturn(), 400, "VALIDATION_FAILED",
                "bad query parameter");
        assertError(getAs(req, "/api/requests/" + id + "/contents/C1/versions/x").andReturn(), 400,
                "VALIDATION_FAILED", "bad path variable");
        // free-text limits of the workflow (2,000) and the request information
        assertError(send(req, patch("/api/requests/" + id), Map.of("purpose", "가".repeat(2001))), 400,
                "VALIDATION_FAILED", "purpose over 2,000");
        assertError(send(req, patch("/api/requests/" + id), Map.of("title", "가".repeat(201))), 400,
                "VALIDATION_FAILED", "title over 200");
        assertError(send(req, post("/api/requests/" + id + "/contents"), Map.of("title", "가".repeat(201))), 400,
                "VALIDATION_FAILED", "content title over 200");
    }

    @Test
    void listSizesAreCappedAt100() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login operator = login(JUNG_OPERATOR);
        assertThat(getJson(admin, "/api/requests?projectId=" + t.projectId() + "&size=1000").path("page")
                .path("size").asInt()).isEqualTo(100);
        assertThat(getJson(admin, "/api/archive/contents?projectId=" + t.projectId() + "&size=1000").path("page")
                .path("size").asInt()).isEqualTo(100);
        assertThat(getJson(admin, "/api/customers/" + t.customerId() + "/audit-logs?size=1000").path("page")
                .path("size").asInt()).isEqualTo(100);
        assertThat(getJson(admin, "/api/customers/" + t.customerId() + "/outbox?size=1000").path("page")
                .path("size").asInt()).isEqualTo(100);
        assertThat(getJson(operator, "/api/ops/audit-logs?size=1000").path("page").path("size").asInt())
                .isEqualTo(100);
        assertThat(getJson(operator, "/api/ops/outbox?size=0").path("page").path("size").asInt()).isEqualTo(20);
        assertThat(getJson(admin, "/api/requests?projectId=" + t.projectId() + "&page=-5").path("page")
                .path("number").asInt()).isZero();
    }

    // ------------------------------------------------------------------ auth hardening

    @Test
    void refreshRefusesCrossSiteCallsAndKeepsTheCookie() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        MvcResult crossSite = mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Sec-Fetch-Site", "cross-site").header("Origin", "https://evil.example")).andReturn();
        assertError(crossSite, 403, "FORBIDDEN", "cross-site refresh");
        assertThat(crossSite.getResponse().getCookie("txtms_refresh")).as("the victim's cookie is not cleared")
                .isNull();
        // a failed refresh of a real session expiry does clear it (contrast)
        MvcResult expired = mvc.perform(post("/api/auth/refresh").cookie(new jakarta.servlet.http.Cookie(
                "txtms_refresh", "not-a-session"))).andReturn();
        assertThat(expired.getResponse().getStatus()).isEqualTo(401);
        assertThat(expired.getResponse().getCookie("txtms_refresh").getMaxAge()).isZero();
        MvcResult sameSite = mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Sec-Fetch-Site", "same-site").header("Origin", "https://other.m1.test")).andReturn();
        assertError(sameSite, 403, "FORBIDDEN", "same-site sibling refresh");
        MvcResult foreignOrigin = mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Origin", "https://evil.example")).andReturn();
        assertError(foreignOrigin, 403, "FORBIDDEN", "foreign Origin without fetch metadata");
        MvcResult nullOrigin = mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Origin", "null")).andReturn();
        assertError(nullOrigin, 403, "FORBIDDEN", "opaque origin");

        // the web app (same origin through the /api rewrite) and non-browser clients keep working
        assertThat(mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Sec-Fetch-Site", "same-origin").header("Origin", "http://localhost:4246")).andReturn()
                .getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())
                .header("Origin", "http://localhost:4246")).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mvc.perform(post("/api/auth/refresh").cookie(req.refreshCookie())).andReturn().getResponse()
                .getStatus()).isEqualTo(200);
        // the cookie itself stays SameSite=Strict, httpOnly and scoped to /api/auth
        MvcResult fresh = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", t.requester(), "password", DEMO_PASSWORD))))
                .andReturn();
        var cookie = (org.springframework.mock.web.MockCookie) fresh.getResponse().getCookie("txtms_refresh");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Strict");
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        // "remember" is optional in the login body (missing = a normal 30-minute session)
        assertThat(cookie.getMaxAge()).isEqualTo(-1);
        // logout needs the bearer token (a cookie alone cannot end someone's session)
        assertError(mvc.perform(post("/api/auth/logout").cookie(req.refreshCookie())).andReturn(), 401,
                "UNAUTHENTICATED", "logout without bearer");
    }

    @Test
    void passwordResetLinksAreSingleUseEvenWhenSubmittedTwiceAtOnce() throws Exception {
        Tenant t = newTenant();
        mvc.perform(post("/api/auth/password-reset-requests").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", t.reviewer())))).andReturn();
        String mail = jdbc.queryForObject("SELECT body FROM outbound_emails WHERE to_address = ? ORDER BY id DESC "
                + "LIMIT 1", String.class, t.reviewer());
        String token = mail.substring(mail.indexOf("/reset/") + "/reset/".length()).trim();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> results = new ArrayList<>();
        for (String password : List.of("FirstPass#2026", "SecondPass#2026")) {
            Callable<Integer> use = () -> {
                start.await();
                return mvc.perform(post("/api/auth/tokens/" + token + "/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("password", password)))).andReturn()
                        .getResponse().getStatus();
            };
            results.add(pool.submit(use));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> f : results) {
            statuses.add(f.get());
        }
        pool.shutdown();
        assertThat(statuses).containsExactlyInAnyOrder(200, 400);
        // and later reuse fails too
        MvcResult again = mvc.perform(post("/api/auth/tokens/" + token + "/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "ThirdPass#2026")))).andReturn();
        assertError(again, 400, "VALIDATION_FAILED", "used reset link");
        // an expired link cannot be used
        mvc.perform(post("/api/auth/password-reset-requests").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", t.lead())))).andReturn();
        String mail2 = jdbc.queryForObject("SELECT body FROM outbound_emails WHERE to_address = ? ORDER BY id DESC "
                + "LIMIT 1", String.class, t.lead());
        String token2 = mail2.substring(mail2.indexOf("/reset/") + "/reset/".length()).trim();
        jdbc.update("UPDATE password_resets SET expires_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 MINUTE) "
                + "WHERE user_id = ?", userId(t.lead()));
        MvcResult expired = mvc.perform(post("/api/auth/tokens/" + token2 + "/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "FourthPass#2026")))).andReturn();
        assertError(expired, 400, "VALIDATION_FAILED", "expired reset link");
    }

    // ------------------------------------------------------------------ exports, scope, Phase 2

    @Test
    void copyAuditIsOnlyForCompletedOriginals() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String id = smsDraft(req, t, "복사 감사", "=HYPERLINK(\"http://evil.example\",\"click\")");
        String r = "/api/requests/" + id;
        assertError(send(req, post(r + "/bundle/copy-events"), Map.of("contentKey", "C1")), 409,
                "REQUEST_STATE_CONFLICT", "copy of a draft");
        submit(req, id);
        assign(lead, id, List.of(rev.userId()), rev.userId());
        assertError(send(req, post(r + "/bundle/copy-events"), Map.of("contentKey", "C1")), 409,
                "REQUEST_STATE_CONFLICT", "copy of an in-progress request");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE target = ?", Integer.class, id))
                .isZero();
        expect(200, rev, post(r + "/complete"), Map.of("rowVersion", rowVersion(rev, id)));
        expect(204, req, post(r + "/bundle/copy-events"), Map.of("contentKey", "C1"));
        assertThat(jdbc.queryForList("SELECT detail FROM audit_logs WHERE target = ? AND action = '완료본 반출'",
                String.class, id)).containsExactly("문안 복사 C1");

        // the XLSX keeps the formula-like body as text with the quote prefix (no formula injection)
        MvcResult xlsx = getAs(req, r + "/bundle/export.xlsx").andReturn();
        assertThat(xlsx.getResponse().getStatus()).isEqualTo(200);
        assertThat(xlsx.getResponse().getHeader("Content-Disposition")).startsWith("attachment;")
                .contains("filename*=UTF-8''");
        try (var wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(
                new java.io.ByteArrayInputStream(xlsx.getResponse().getContentAsByteArray()))) {
            var cell = wb.getSheetAt(0).getRow(1).getCell(3);
            assertThat(cell.getCellType()).isEqualTo(org.apache.poi.ss.usermodel.CellType.STRING);
            assertThat(cell.getStringCellValue()).startsWith("=HYPERLINK");
            assertThat(cell.getCellStyle().getQuotePrefixed()).isTrue();
        }
    }

    @Test
    void newDraftsAreRefusedInAStoppedProject() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String done = smsDraft(req, t, "중지 프로젝트 원본", "본문");
        submit(req, done);
        assign(lead, done, List.of(rev.userId()), rev.userId());
        expect(200, rev, post("/api/requests/" + done + "/complete"), Map.of("rowVersion", rowVersion(rev, done)));
        jdbc.update("UPDATE projects SET active = 0 WHERE id = ?", t.projectId());

        assertError(send(req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS")), 409,
                "REQUEST_STATE_CONFLICT", "new request");
        assertError(send(req, post("/api/requests/" + done + "/clone"), null), 409, "REQUEST_STATE_CONFLICT",
                "clone");
        assertError(send(req, post("/api/requests/" + done + "/follow-up"), Map.of()), 409,
                "REQUEST_STATE_CONFLICT", "follow-up");
        jdbc.update("UPDATE projects SET active = 1 WHERE id = ?", t.projectId());
        expect(201, req, post("/api/requests/" + done + "/clone"), null);
    }

    @Test
    void phase2FeaturesAreNotExposed() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login operator = login(JUNG_OPERATOR);
        // notices: only customer and project scopes (common/standard notices and scheduling are Phase 2)
        assertError(send(admin, post("/api/customers/" + t.customerId() + "/notices"), Map.of("scope", "COMMON",
                "title", "x", "body", "y")), 400, "VALIDATION_FAILED", "common notice");
        MvcResult scheduled = send(admin, post("/api/customers/" + t.customerId() + "/notices"),
                Map.of("scope", "CUSTOMER", "title", "즉시 게시", "body", "본문", "publishAt", "2030-01-01T00:00:00Z"));
        assertThat(scheduled.getResponse().getStatus()).isIn(201, 400);
        if (scheduled.getResponse().getStatus() == 201) {
            assertThat(read(scheduled).has("publishAt")).as("no scheduled posting: posted at once").isFalse();
        }
        // correction datasets: the common dataset, deployment, restore and conflict tools are Phase 2
        assertError(send(operator, post("/api/ops/datasets"), Map.of("scope", "COMMON", "rules",
                List.of(Map.of("ruleId", "R1", "originalExpr", "a", "recommendedExpr", "b")))), 400,
                "VALIDATION_FAILED", "common dataset");
        for (String[] e : List.of(new String[] {"POST", "/api/ops/datasets/1/deploy"},
                new String[] {"POST", "/api/ops/datasets/1/restore"},
                new String[] {"POST", "/api/ops/datasets/conflicts/resolve"},
                new String[] {"PUT", "/api/guides/ALIMTALK"},
                new String[] {"PATCH", "/api/me/theme"},
                new String[] {"PATCH", "/api/archive/contents/REQ-1:C1/visibility"},
                new String[] {"POST", "/api/ops/access-grants"},
                new String[] {"GET", "/api/ops/feedback"},
                new String[] {"POST", "/api/auth/sso/google"})) {
            MvcResult result = call(e[1].startsWith("/api/ops") ? operator : admin, e[0], e[1], Map.of());
            assertThat(result.getResponse().getStatus()).as(e[0] + " " + e[1]).isIn(401, 404);
        }
        // mock management is Phase 2: the operator switch changes "active" only
        boolean mockBefore = jdbc.queryForObject("SELECT mock_enabled FROM content_types WHERE type = 'SMS'",
                Boolean.class);
        boolean activeBefore = jdbc.queryForObject("SELECT active FROM content_types WHERE type = 'SMS'",
                Boolean.class);
        JsonNode type = expect(200, operator, patch("/api/ops/content-types/SMS"), Map.of("active", activeBefore,
                "mockEnabled", !mockBefore));
        assertThat(type.path("mockEnabled").asBoolean()).isEqualTo(mockBefore);
        // the writing guide is read-only
        assertThat(getJson(admin, "/api/guides/ALIMTALK").path("type").asString()).isEqualTo("ALIMTALK");
    }
}
