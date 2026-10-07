package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** Request authoring: create → autosave → contents → attachments → submit validation → submit → cancel → clone. */
class RequestAuthoringIntegrationTest extends IntegrationTestBase {

    static final byte[] PDF = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13};
    static final byte[] EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
            .getBytes(StandardCharsets.US_ASCII);

    private JsonNode create(Login login, long projectId, String type) throws Exception {
        return expect(201, login, post("/api/requests"), Map.of("projectId", projectId, "type", type));
    }

    private static Map<String, Object> info(String title) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("hopeDueDate", "2026-12-20");
        m.put("purpose", "약관 개정 고지");
        m.put("target", "전체 회원");
        m.put("background", "법령 개정");
        m.put("campaign", "12월 고지");
        return m;
    }

    private List<String> history(Login login, String id) throws Exception {
        List<String> actions = new ArrayList<>();
        getJson(login, "/api/requests/" + id + "/history").forEach(h -> actions.add(h.path("action").asString()));
        return actions;
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asString()));
        return out;
    }

    @Test
    void freeformRequestLifecycle() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());

        // ---- create
        JsonNode created = create(req, t.projectId(), "FREEFORM");
        String id = created.path("id").asString();
        assertThat(id).matches("REQ-\\d{4}-\\d{3,}");
        assertThat(created.path("status").asString()).isEqualTo("DRAFT");
        assertThat(created.path("round").asInt()).isEqualTo(1);
        assertThat(created.path("contents")).hasSize(1);
        JsonNode c1 = created.path("contents").get(0);
        assertThat(c1.path("key").asString()).isEqualTo("C1");
        assertThat(c1.path("title").asString()).isEqualTo("콘텐츠 1");
        assertThat(c1.path("payload").path("text").asString()).isEmpty();
        assertThat(strings(created.path("allowedActions"))).contains("EDIT_REQUEST", "EDIT_CONTENT", "SUBMIT", "CLONE");
        assertThat(history(req, id)).containsExactly("요청 작성");
        // the detail carries one "contents" (full Content); the list summary carries { key, title }
        String detailText = text(send(req, get("/api/requests/" + id), null));
        assertThat(detailText.split("\"contents\":", -1)).hasSize(2);
        JsonNode summary = getJson(req, "/api/requests?projectId=" + t.projectId()).path("content").get(0);
        assertThat(summary.path("contents").toString()).isEqualTo("[{\"key\":\"C1\",\"title\":\"콘텐츠 1\"}]");

        // ---- autosave with conflict detection
        JsonNode saved = expect(200, req, put("/api/requests/" + id + "/contents/C1"),
                Map.of("title", "고지 문안", "payload", Map.of("title", "", "text", "#{customer_name}님, 약관이 바뀝니다")));
        Instant savedAt = Instant.parse(saved.path("savedAt").asString());
        assertThat(saved.path("version").asInt()).isEqualTo(1);
        assertThat(saved.path("payload").path("text").asString()).isEqualTo("#{customer_name}님, 약관이 바뀝니다");
        expect(409, req, put("/api/requests/" + id + "/contents/C1"), Map.of("title", "다른 탭",
                "payload", Map.of("text", "old"), "expectedSavedAt", savedAt.minusSeconds(5).toString()));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("title", "고지 문안",
                "payload", Map.of("text", "#{customer_name}님, 약관이 바뀝니다"), "expectedSavedAt", savedAt.toString()));
        JsonNode badShape = expect(400, req, put("/api/requests/" + id + "/contents/C1"),
                Map.of("payload", Map.of("body", "SMS key on free-form")));
        assertThat(badShape.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(badShape.path("fieldErrors").get(0).path("field").asString()).isEqualTo("payload.body");

        // ---- contents: numbers are never reused
        assertThat(expect(201, req, post("/api/requests/" + id + "/contents"), Map.of()).path("key").asString())
                .isEqualTo("C2");
        expect(204, req, delete("/api/requests/" + id + "/contents/C2"), null);
        JsonNode c3 = expect(201, req, post("/api/requests/" + id + "/contents"), Map.of("title", "약관 원문"));
        assertThat(c3.path("key").asString()).isEqualTo("C3");
        assertThat(c3.path("title").asString()).isEqualTo("약관 원문");

        // ---- attachments: one valid upload, three blocked ones (each written to history)
        MvcResult up = upload(req, "/api/requests/" + id + "/contents/C3/files", "계약서 개정안.pdf", PDF, null);
        assertThat(up.getResponse().getStatus()).isEqualTo(201);
        JsonNode file = read(up);
        long fileId = file.path("id").asLong();
        assertThat(file.path("unit").asString()).isEqualTo("PAGE");
        assertThat(file.path("version").asInt()).isEqualTo(1);
        assertThat(file.path("scanStatus").asString()).isEqualTo("SAFE");
        assertThat(file.path("sizeBytes").asLong()).isEqualTo(PDF.length);
        assertThat(file.path("totalAmount").isNull()).isTrue();

        MvcResult fake = upload(req, "/api/requests/" + id + "/contents/C3/files", "가짜.pdf",
                "not a pdf".getBytes(StandardCharsets.UTF_8), null);
        assertThat(fake.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(fake).path("code").asString()).isEqualTo("FILE_REJECTED");
        assertThat(read(fake).path("message").asString()).isEqualTo("확장자와 실제 파일 시그니처가 다릅니다");
        JsonNode unsafe = read(upload(req, "/api/requests/" + id + "/contents/C3/files", "eicar.txt", EICAR, null));
        assertThat(unsafe.path("code").asString()).isEqualTo("FILE_UNSAFE");
        assertThat(unsafe.path("message").asString()).isEqualTo("위험 파일 검사 결과: 등록할 수 없습니다");
        MvcResult scanFailed = upload(req, "/api/requests/" + id + "/contents/C3/files", "a.pdf", PDF, "FAILED");
        assertThat(scanFailed.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(scanFailed).path("code").asString()).isEqualTo("FILE_SCAN_FAILED");
        assertThat(read(scanFailed).path("message").asString()).isEqualTo("검사 서비스 실패 시연: 등록할 수 없습니다");
        assertThat(read(upload(req, "/api/requests/" + id + "/contents/C1/files", "a.exe", PDF, null))
                .path("message").asString()).isEqualTo("허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_history WHERE request_id = ? AND action = "
                + "'파일 등록 차단'", Integer.class, id)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT detail FROM request_history WHERE request_id = ? AND action = "
                + "'파일 등록 차단' ORDER BY id LIMIT 1", String.class, id)).isEqualTo("확장자와 실제 파일 시그니처가 다릅니다");

        // ---- submit validation failure with the screen wording
        JsonNode detail = getJson(req, "/api/requests/" + id);
        long rowVersion = detail.path("rowVersion").asLong();
        JsonNode failed = expect(400, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion));
        assertThat(failed.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(failed.path("message").asString()).isEqualTo("검수를 요청하려면 다음 항목을 채우세요");
        assertThat(strings(failed.path("details"))).containsExactly("요청 정보: 제목", "요청 정보: 희망 납기", "요청 정보: 목적",
                "요청 정보: 대상 고객", "요청 정보: 배경", "C3 약관 원문: 계약서 개정안.pdf 전체 분량과 실제 검수 범위");
        assertThat(failed.path("fieldErrors").get(0).path("field").asString()).isEqualTo("title");

        // ---- fix: request information (partial PATCH) and attachment amounts
        JsonNode patched = expect(200, req, patch("/api/requests/" + id), info("12월 약관 개정 고지"));
        assertThat(patched.path("title").asString()).isEqualTo("12월 약관 개정 고지");
        assertThat(patched.path("hopeDueDate").asString()).isEqualTo("2026-12-20");
        assertThat(patched.path("rowVersion").asLong()).isGreaterThan(rowVersion);
        JsonNode partial = expect(200, req, patch("/api/requests/" + id), Map.of("urgency", "URGENT"));
        assertThat(partial.path("purpose").asString()).isEqualTo("약관 개정 고지");
        assertThat(partial.path("urgency").asString()).isEqualTo("URGENT");
        expect(400, req, patch("/api/requests/" + id), Map.of("title", "가".repeat(201)));

        expect(200, req, patch("/api/requests/" + id + "/contents/C3/files/" + fileId),
                Map.of("totalAmount", 10, "reviewAmount", 12, "rangeNote", "전체"));
        long rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        assertThat(strings(expect(400, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv))
                .path("details"))).containsExactly("C3: 계약서 개정안.pdf 검수 범위는 전체 분량 이내의 양의 정수");
        JsonNode ranged = expect(200, req, patch("/api/requests/" + id + "/contents/C3/files/" + fileId),
                Map.of("totalAmount", 10, "reviewAmount", 6, "rangeNote", "1~6쪽"));
        assertThat(ranged.path("reviewAmount").asInt()).isEqualTo(6);

        // ---- stale rowVersion is a conflict
        JsonNode stale = expect(409, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv - 1));
        assertThat(stale.path("code").asString()).isEqualTo("REQUEST_STATE_CONFLICT");
        assertThat(stale.path("message").asString()).isEqualTo("권한 또는 요청 상태가 변경되었습니다");
        expect(400, req, post("/api/requests/" + id + "/submit"), Map.of());

        // ---- submit (idempotent with the same key)
        MvcResult submitResult = send(req, post("/api/requests/" + id + "/submit").header("Idempotency-Key", "k-1"),
                Map.of("rowVersion", rv));
        assertThat(submitResult.getResponse().getStatus()).as(text(submitResult)).isEqualTo(200);
        JsonNode submitted = read(submitResult);
        assertThat(submitted.path("status").asString()).isEqualTo("WAITING");
        assertThat(submitted.path("round").asInt()).isEqualTo(1);
        assertThat(submitted.path("dueDate").asString()).isEqualTo("2026-12-20");
        assertThat(submitted.path("contentVersions").toString()).isEqualTo("[1,1]");
        assertThat(submitted.path("contents").get(0).path("versions")).hasSize(1);
        assertThat(strings(submitted.path("allowedActions"))).contains("CANCEL").doesNotContain("SUBMIT");
        String submittedAt = submitted.path("submittedAt").asString();
        assertThat(submittedAt).isNotEmpty();

        MvcResult again = send(req, post("/api/requests/" + id + "/submit").header("Idempotency-Key", "k-1"),
                Map.of("rowVersion", rv));
        assertThat(again.getResponse().getStatus()).isEqualTo(200);
        assertThat(read(again).path("rowVersion").asLong()).isEqualTo(submitted.path("rowVersion").asLong());
        expect(409, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion",
                submitted.path("rowVersion").asLong()));
        assertThat(history(req, id).stream().filter("검수 요청"::equals).count()).isEqualTo(1);

        long leadId = userId(t.lead());
        assertThat(jdbc.queryForObject("SELECT text FROM notifications WHERE user_id = ? AND request_id = ? "
                + "AND kind = 'ASSIGN'", String.class, leadId, id))
                .isEqualTo("신규 검수 요청이 배정을 기다립니다: 12월 약관 개정 고지 (납기 2026-12-20)");

        // ---- editing is closed while waiting
        expect(409, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("text", "x")));
        expect(409, req, patch("/api/requests/" + id), Map.of("title", "x"));

        // ---- download: requester and lead, audited; other tenants see nothing
        MvcResult dl = send(req, get("/api/requests/" + id + "/contents/C3/files/" + fileId + "/versions/1/download"),
                null);
        assertThat(dl.getResponse().getStatus()).isEqualTo(200);
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(dl.getResponse().getHeader("Content-Disposition")).isEqualTo("attachment; filename=\"___ ___.pdf\"; "
                + "filename*=UTF-8''%EA%B3%84%EC%95%BD%EC%84%9C%20%EA%B0%9C%EC%A0%95%EC%95%88.pdf");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = '파일 다운로드' AND target = ? "
                + "AND customer_id = ? AND retention_until IS NOT NULL", Integer.class, id, t.customerId()))
                .isEqualTo(1);
        Login lead = login(t.lead());
        assertThat(send(lead, get("/api/requests/" + id + "/contents/C3/files/" + fileId + "/versions/1/download"),
                null).getResponse().getStatus()).isEqualTo(200);
        expect(404, lead, get("/api/requests/" + id + "/contents/C3/files/" + fileId + "/versions/2/download"), null);
        Login moon = login(MOON_REQUESTER);
        expect(404, moon, get("/api/requests/" + id + "/contents/C3/files/" + fileId + "/versions/1/download"), null);
        expect(404, moon, get("/api/requests/" + id), null);

        // ---- cancel → edit → resubmit keeps round and first submission time; only the changed content gets v2
        JsonNode cancelled = expect(200, req, post("/api/requests/" + id + "/cancel"),
                Map.of("rowVersion", submitted.path("rowVersion").asLong()));
        assertThat(cancelled.path("status").asString()).isEqualTo("DRAFT");
        assertThat(cancelled.path("submittedAt").asString()).isEqualTo(submittedAt);
        assertThat(jdbc.queryForObject("SELECT text FROM notifications WHERE user_id = ? AND request_id = ? "
                + "AND kind = 'INFO'", String.class, leadId, id)).isEqualTo("12월 약관 개정 고지 요청이 취소되었습니다");
        expect(200, req, put("/api/requests/" + id + "/contents/C1"),
                Map.of("title", "고지 문안", "payload", Map.of("text", "#{customer_name}님, 약관이 바뀝니다 (수정)")));
        JsonNode resubmitted = expect(200, req, post("/api/requests/" + id + "/submit"),
                Map.of("rowVersion", cancelled.path("rowVersion").asLong()));
        assertThat(resubmitted.path("status").asString()).isEqualTo("WAITING");
        assertThat(resubmitted.path("round").asInt()).isEqualTo(1);
        assertThat(resubmitted.path("submittedAt").asString()).isEqualTo(submittedAt);
        assertThat(resubmitted.path("contentVersions").toString()).isEqualTo("[2,1]");
        assertThat(history(req, id)).containsSubsequence("요청 작성", "콘텐츠 추가", "콘텐츠 삭제", "콘텐츠 추가", "파일 첨부",
                "파일 등록 차단", "검수 요청", "요청 취소", "검수 요청");
        assertThat(jdbc.queryForObject("SELECT cancelled FROM requests WHERE id = ?", Boolean.class, id)).isFalse();

        // ---- clone: new draft, contents renumbered, attachment shared, no hope due date
        JsonNode clone = expect(201, req, post("/api/requests/" + id + "/clone"), null);
        String cloneId = clone.path("id").asString();
        assertThat(cloneId).isNotEqualTo(id);
        assertThat(clone.path("status").asString()).isEqualTo("DRAFT");
        assertThat(clone.path("title").asString()).isEqualTo("12월 약관 개정 고지 (복제)");
        assertThat(clone.path("purpose").asString()).isEqualTo("약관 개정 고지");
        assertThat(clone.path("hopeDueDate").isNull()).isTrue();
        assertThat(clone.path("submittedAt").isNull()).isTrue();
        assertThat(clone.path("contents")).hasSize(2);
        assertThat(clone.path("contents").get(1).path("key").asString()).isEqualTo("C2");
        assertThat(clone.path("contents").get(1).path("versions")).isEmpty();
        JsonNode clonedFile = clone.path("contents").get(1).path("files").get(0);
        assertThat(clonedFile.path("name").asString()).isEqualTo("계약서 개정안.pdf");
        assertThat(clonedFile.path("reviewAmount").asInt()).isEqualTo(6);
        assertThat(history(req, cloneId)).containsExactly("요청 복제");
        assertThat(getJson(req, "/api/requests/" + cloneId + "/history").get(0).path("detail").asString())
                .isEqualTo("원본 " + id);
        MvcResult clonedDownload = send(req, get("/api/requests/" + cloneId + "/contents/C2/files/"
                + clonedFile.path("id").asLong() + "/versions/1/download"), null);
        assertThat(clonedDownload.getResponse().getContentAsByteArray()).isEqualTo(PDF);
    }

    @Test
    void permissionDenials() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login req2 = login(t.requester2());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        Login moon = login(MOON_REQUESTER);

        // only requesters create, other tenants do not see the project
        assertThat(expect(403, rev, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("message").asString()).isEqualTo("요청자 역할이 있어야 요청을 만들 수 있습니다");
        expect(403, admin, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"));
        expect(404, moon, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"));
        expect(400, req, post("/api/requests"), Map.of("type", "SMS"));

        JsonNode draft = create(req, t.projectId(), "SMS");
        String id = draft.path("id").asString();
        // drafts are private to the author (admins included): DRAFT_PRIVATE; other tenants: NOT_FOUND
        for (Login other : List.of(req2, rev, admin)) {
            assertThat(expect(403, other, patch("/api/requests/" + id), Map.of("title", "x")).path("code")
                    .asString()).isEqualTo("DRAFT_PRIVATE");
            expect(403, other, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of()));
            expect(403, other, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", 0));
            expect(403, other, get("/api/requests/" + id + "/history"), null);
            assertThat(upload(other, "/api/requests/" + id + "/contents/C1/images", "a.png", PNG, null)
                    .getResponse().getStatus()).isEqualTo(403);
        }
        assertThat(expect(403, req2, get("/api/requests/" + id), null).path("message").asString())
                .isEqualTo(id + "는 아직 작성 중인 요청입니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다.");
        expect(404, moon, patch("/api/requests/" + id), Map.of("title", "x"));
        expect(404, moon, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of()));
        expect(404, moon, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", 0));
        // a non-author requester cannot clone someone else's draft
        expect(403, req2, post("/api/requests/" + id + "/clone"), null);

        // after submit the reviewer sees it but cannot edit, clone or cancel
        expect(200, req, patch("/api/requests/" + id), info("문자 고지"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload",
                Map.of("sender", "1588-0000", "body", "안내 문자입니다")));
        long rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv));
        long waitingVersion = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        expect(409, rev, post("/api/requests/" + id + "/clone"), null);
        expect(409, rev, post("/api/requests/" + id + "/cancel"), Map.of("rowVersion", waitingVersion));
        expect(409, req2, post("/api/requests/" + id + "/cancel"), Map.of("rowVersion", waitingVersion));
        expect(409, req, post("/api/requests/" + id + "/contents"), Map.of());
        expect(409, req, delete("/api/requests/" + id + "/contents/C1"), null);
        // another requester of the project may clone a visible request
        assertThat(expect(201, req2, post("/api/requests/" + id + "/clone"), null).path("requesterId").asLong())
                .isEqualTo(userId(t.requester2()));

        // demo tenants: author-only drafts and other-tenant requests stay hidden
        Login kim = login(KIM_REQUESTER);
        expect(404, kim, patch("/api/requests/" + id), Map.of("title", "x"));
        expect(409, kim, patch("/api/requests/REQ-2609-101"), Map.of("title", "x"));
        expect(403, login(PARK_REVIEWER), patch("/api/requests/REQ-2609-105"), Map.of("title", "x"));
        expect(403, kim, post("/api/requests/REQ-2609-110/clone"), null);
        expect(404, moon, post("/api/requests/REQ-2609-101/clone"), null);
        expect(404, login(JUNG_OPERATOR), post("/api/requests/REQ-2609-101/clone"), null);
    }

    @Test
    void lastContentCannotBeDeletedAndTypeChangeResetsContents() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = create(req, t.projectId(), "ALIMTALK").path("id").asString();
        assertThat(expect(400, req, delete("/api/requests/" + id + "/contents/C1"), null).path("message").asString())
                .isEqualTo("콘텐츠가 1건 이상 필요합니다");
        expect(201, req, post("/api/requests/" + id + "/contents"), null);
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload",
                Map.of("templateCode", "HB_POINT_01", "body", "본문", "buttons", List.of(Map.of("name", "a",
                        "link", "https://a.kr")))));
        JsonNode tooMany = expect(400, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload",
                Map.of("buttons", List.of(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of()))));
        assertThat(tooMany.path("code").asString()).isEqualTo("LIMIT_EXCEEDED");

        JsonNode changed = expect(200, req, put("/api/requests/" + id + "/type"), Map.of("type", "RCS"));
        assertThat(changed.path("type").asString()).isEqualTo("RCS");
        assertThat(changed.path("contents")).hasSize(1);
        assertThat(changed.path("contents").get(0).path("key").asString()).isEqualTo("C1");
        assertThat(changed.path("contents").get(0).path("payload").path("cards")).hasSize(1);
        assertThat(history(req, id)).endsWith("유형 변경");
        assertThat(getJson(req, "/api/requests/" + id + "/history").get(2).path("detail").asString())
                .isEqualTo("RCS");
        // the next content continues after C2 even though C2 was removed by the type change
        assertThat(expect(201, req, post("/api/requests/" + id + "/contents"), null).path("key").asString())
                .isEqualTo("C3");

        // RCS card image: upload, reference from the payload, serve within the request only
        MvcResult img = upload(req, "/api/requests/" + id + "/contents/C1/images", "card.png", PNG, null);
        assertThat(img.getResponse().getStatus()).as(text(img)).isEqualTo(201);
        String imageKey = read(img).path("imageKey").asString();
        assertThat(imageKey).startsWith("img_");
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("cards",
                List.of(Map.of("title", "t", "body", "b", "imageKey", imageKey, "imageAlt", "카드 이미지")))));
        MvcResult served = send(req, get("/api/requests/" + id + "/images/" + imageKey), null);
        assertThat(served.getResponse().getStatus()).isEqualTo(200);
        assertThat(served.getResponse().getContentType()).isEqualTo("image/png");
        assertThat(served.getResponse().getContentAsByteArray()).isEqualTo(PNG);
        expect(404, login(MOON_REQUESTER), get("/api/requests/" + id + "/images/" + imageKey), null);
        JsonNode foreign = expect(400, req, put("/api/requests/" + id + "/contents/C3"), Map.of("payload",
                Map.of("cards", List.of(Map.of("imageKey", "img_doesnotexist")))));
        assertThat(foreign.path("fieldErrors").get(0).path("message").asString()).isEqualTo("등록되지 않은 이미지입니다");
        assertThat(read(upload(req, "/api/requests/" + id + "/contents/C1/images", "doc.pdf", PDF, null))
                .path("message").asString()).isEqualTo("PNG/JPG 이미지를 선택하세요");
        assertThat(read(upload(req, "/api/requests/" + id + "/contents/C1/images", "fake.png", PDF, null))
                .path("message").asString()).isEqualTo("확장자와 실제 파일 시그니처가 다릅니다");
        // attachments are free-form only
        assertThat(read(upload(req, "/api/requests/" + id + "/contents/C1/files", "a.pdf", PDF, null))
                .path("code").asString()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void submitValidationOfTypedContents() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String sms = create(req, t.projectId(), "SMS").path("id").asString();
        expect(200, req, patch("/api/requests/" + sms), info("문자"));
        expect(200, req, put("/api/requests/" + sms + "/contents/C1"), Map.of("payload", Map.of("sender", "02-999",
                "body", "가".repeat(990) + " #{customer_name} #{unknown_key}", "customerCenter", true, "optOut", true)));
        long rv = getJson(req, "/api/requests/" + sms).path("rowVersion").asLong();
        assertThat(strings(expect(400, req, post("/api/requests/" + sms + "/submit"), Map.of("rowVersion", rv))
                .path("details"))).containsExactly("C1: 등록된 발신번호", "C1: LMS 최대 2,000바이트 (안내 포함)",
                        "C1: 등록되지 않았거나 비활성 변수 unknown_key");

        String alim = create(req, t.projectId(), "ALIMTALK").path("id").asString();
        expect(200, req, patch("/api/requests/" + alim), info("알림톡"));
        expect(200, req, put("/api/requests/" + alim + "/contents/C1"), Map.of("payload", Map.of(
                "templateCode", "NOT_REGISTERED", "body", "본문",
                "buttons", List.of(Map.of("name", "열네 글자를 넘는 아주 긴 버튼 이름", "link", "javascript:alert(1)")))));
        rv = getJson(req, "/api/requests/" + alim).path("rowVersion").asLong();
        assertThat(strings(expect(400, req, post("/api/requests/" + alim + "/submit"), Map.of("rowVersion", rv))
                .path("details"))).containsExactly("C1: 등록된 승인 템플릿", "C1: 버튼명 최대 14자",
                        "C1: HTTP/HTTPS 버튼 링크");

        // inactive project blocks submit
        expect(200, req, put("/api/requests/" + alim + "/contents/C1"), Map.of("payload", Map.of(
                "templateCode", "HB_POINT_01", "body", "#{customer_name}님", "buttons", List.of())));
        jdbc.update("UPDATE projects SET active = 0 WHERE id = ?", t.projectId());
        try {
            assertThat(strings(expect(400, req, post("/api/requests/" + alim + "/submit"), Map.of("rowVersion", rv))
                    .path("details"))).containsExactly("사용 중인 프로젝트에서 검수를 요청하세요");
        } finally {
            jdbc.update("UPDATE projects SET active = 1 WHERE id = ?", t.projectId());
        }
        assertThat(expect(200, req, post("/api/requests/" + alim + "/submit"), Map.of("rowVersion", rv))
                .path("status").asString()).isEqualTo("WAITING");
    }

    @Test
    void recallApprovalOpensANewRoundAndBumpsOnlyChangedContents() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = create(req, t.projectId(), "SMS").path("id").asString();
        expect(200, req, patch("/api/requests/" + id), info("회수 시나리오"));
        expect(201, req, post("/api/requests/" + id + "/contents"), null);
        for (String key : List.of("C1", "C2")) {
            expect(200, req, put("/api/requests/" + id + "/contents/" + key), Map.of("payload",
                    Map.of("sender", "1588-0000", "body", "본문 " + key)));
        }
        long rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        String submittedAt = expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv))
                .path("submittedAt").asString();

        // the recall workflow arrives with the review milestone: put the request where an approved recall leaves it
        jdbc.update("UPDATE requests SET status = 'DRAFT', round_bump = 1, row_version = row_version + 1 WHERE id = ?",
                id);
        expect(200, req, put("/api/requests/" + id + "/contents/C2"), Map.of("payload",
                Map.of("sender", "1588-0000", "body", "본문 C2 수정")));
        expect(201, req, post("/api/requests/" + id + "/contents"), null);
        expect(200, req, put("/api/requests/" + id + "/contents/C3"), Map.of("payload",
                Map.of("sender", "1588-0000", "body", "새 콘텐츠")));
        rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        JsonNode resubmitted = expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv));
        assertThat(resubmitted.path("round").asInt()).isEqualTo(2);
        assertThat(resubmitted.path("submittedAt").asString()).isEqualTo(submittedAt);
        assertThat(resubmitted.path("contentVersions").toString()).isEqualTo("[1,2,1]");
        assertThat(resubmitted.path("contents").get(1).path("versions")).hasSize(2);
        assertThat(resubmitted.path("contents").get(2).path("versions")).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT round FROM request_history WHERE request_id = ? AND action = '검수 요청' "
                + "ORDER BY id DESC LIMIT 1", Integer.class, id)).isEqualTo(2);
    }

    @Test
    void assignedReviewerUploadsFileRevisionsWithTheSameExtension() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = create(req, t.projectId(), "FREEFORM").path("id").asString();
        expect(200, req, patch("/api/requests/" + id), info("수정본"));
        long fileId = read(upload(req, "/api/requests/" + id + "/contents/C1/files", "원본.pdf", PDF, null))
                .path("id").asLong();
        expect(200, req, patch("/api/requests/" + id + "/contents/C1/files/" + fileId),
                Map.of("totalAmount", 3, "reviewAmount", 3));
        long rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv));

        // assignment arrives with the review milestone: assign the reviewer directly
        long reviewerId = userId(t.reviewer());
        jdbc.update("UPDATE requests SET status = 'IN_REVIEW', primary_reviewer_id = ? WHERE id = ?", reviewerId, id);
        jdbc.update("INSERT INTO request_reviewers (request_id, sort_order, user_id) VALUES (?, 0, ?)", id, reviewerId);

        String url = "/api/requests/" + id + "/contents/C1/files/" + fileId + "/versions";
        Login rev = login(t.reviewer());
        assertThat(read(upload(rev, url, "수정본.txt", "text".getBytes(StandardCharsets.UTF_8), null))
                .path("message").asString()).isEqualTo("수정본은 pdf 형식이어야 합니다");
        assertThat(upload(req, url, "수정본.pdf", PDF, null).getResponse().getStatus()).isEqualTo(409);
        assertThat(upload(login(t.requester2()), url, "수정본.pdf", PDF, null).getResponse().getStatus())
                .isEqualTo(409);
        byte[] revised = "%PDF-1.7 revised".getBytes(StandardCharsets.US_ASCII);
        MvcResult ok = upload(rev, url, "수정본 v2.pdf", revised, null);
        assertThat(ok.getResponse().getStatus()).as(text(ok)).isEqualTo(201);
        JsonNode meta = read(ok);
        assertThat(meta.path("id").asLong()).isEqualTo(fileId);
        assertThat(meta.path("version").asInt()).isEqualTo(2);
        assertThat(meta.path("name").asString()).isEqualTo("수정본 v2.pdf");
        assertThat(meta.path("versions")).hasSize(2);
        assertThat(meta.path("reviewAmount").asInt()).isEqualTo(3);
        String base = "/api/requests/" + id + "/contents/C1/files/" + fileId + "/versions/";
        assertThat(send(req, get(base + "1/download"), null).getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(send(req, get(base + "2/download"), null).getResponse().getContentAsByteArray()).isEqualTo(revised);
        assertThat(history(req, id)).endsWith("파일 등록 차단", "파일 수정본 등록");
        // drafts-only operations are closed in review
        expect(409, rev, patch("/api/requests/" + id + "/contents/C1/files/" + fileId), Map.of("totalAmount", 1));
        expect(409, rev, delete("/api/requests/" + id + "/contents/C1/files/" + fileId), null);
    }

    @Test
    void concurrentCreatesGetDistinctSequentialIds() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        int n = 8;
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(n);
        try {
            List<java.util.concurrent.Future<String>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                futures.add(pool.submit(() -> create(req, t.projectId(), "SMS").path("id").asString()));
            }
            java.util.Set<String> ids = new java.util.TreeSet<>();
            for (java.util.concurrent.Future<String> f : futures) {
                ids.add(f.get());
            }
            assertThat(ids).hasSize(n);
            List<Integer> numbers = ids.stream().map(s -> Integer.parseInt(s.substring(9))).sorted().toList();
            assertThat(numbers.getLast() - numbers.getFirst()).isEqualTo(n - 1);
        } finally {
            pool.shutdownNow();
        }
    }
}
