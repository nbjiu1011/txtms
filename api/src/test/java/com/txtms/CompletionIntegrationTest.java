package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Completion, approval, revision request, completion bundle, exports (XLSX, ZIP, copy audit), follow-ups and the
 * completed-content archive. Each test runs on its own tenant (one approval-enabled scenario, the others without
 * approval).
 */
class CompletionIntegrationTest extends IntegrationTestBase {

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
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)", t.projectId(), id,
                role);
        return id;
    }

    private static String email(Tenant t, String local) {
        return local + t.requester().substring(t.requester().indexOf('@'));
    }

    private String draft(Login req, Tenant t, String type, String title, String campaign) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", type))
                .path("id").asString();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", title);
        info.put("hopeDueDate", "2026-12-20");
        info.put("purpose", "안내");
        info.put("target", "전체 회원");
        info.put("background", "정기 발송");
        info.put("campaign", campaign);
        expect(200, req, patch("/api/requests/" + id), info);
        return id;
    }

    private void save(Login req, String id, String key, Object payload) throws Exception {
        expect(200, req, put("/api/requests/" + id + "/contents/" + key), Map.of("payload", payload));
    }

    private void submit(Login req, String id) throws Exception {
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
    }

    private JsonNode assign(Login lead, String id, List<Long> reviewers, long primary) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", reviewers);
        body.put("primaryReviewerId", primary);
        body.put("dueDate", "2026-12-15");
        body.put("rowVersion", rowVersion(lead, id));
        return expect(200, lead, post("/api/requests/" + id + "/assignment"), body);
    }

    private JsonNode complete(Login primary, String id, int status) throws Exception {
        return expect(status, primary, post("/api/requests/" + id + "/complete"),
                Map.of("rowVersion", rowVersion(primary, id)));
    }

    private static Map<String, Object> alimtalk(String body, String... buttons) {
        List<Map<String, String>> list = new ArrayList<>();
        for (int i = 0; i < buttons.length; i += 2) {
            list.add(Map.of("name", buttons[i], "link", buttons[i + 1]));
        }
        return Map.of("templateCode", "HB_POINT_01", "body", body, "buttons", list);
    }

    private static Map<String, Object> sms(String body) {
        return Map.of("sender", "1588-0000", "body", body, "customerCenter", false, "optOut", false);
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private List<String> actions(Login login, String id) throws Exception {
        return strings(getJson(login, "/api/requests/" + id).path("allowedActions"));
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asString()));
        return out;
    }

    private List<Map<String, Object>> history(String id, String action) {
        return jdbc.queryForList("SELECT detail, actor_id, round FROM request_history WHERE request_id = ? AND "
                + "action = ? ORDER BY id", id, action);
    }

    private List<Long> recipients(String id, String kind, String text) {
        return jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND kind = ? AND text = ? "
                + "ORDER BY user_id", Long.class, id, kind, text);
    }

    private List<Map<String, Object>> audits(String id, String action) {
        return jdbc.queryForList("SELECT actor_id, customer_id, detail FROM audit_logs WHERE target = ? AND action = ? "
                + "ORDER BY id", id, action);
    }

    private List<String> viewIds(Login login, Tenant t, String view) throws Exception {
        List<String> ids = new ArrayList<>();
        getJson(login, "/api/requests?projectId=" + t.projectId() + "&view=" + view).path("content")
                .forEach(n -> ids.add(n.path("id").asString()));
        return ids;
    }

    private static byte[] body(MvcResult result) {
        return result.getResponse().getContentAsByteArray();
    }

    private Map<String, byte[]> unzip(byte[] zip) throws Exception {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                entries.put(e.getName(), in.readAllBytes());
            }
        }
        return entries;
    }

    // ------------------------------------------------------------------ approval not used

    @Test
    void reviewCompletionWithoutApprovalFreezesTheBundleAndExports() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        long revId = rev.userId();
        long leadId = lead.userId();
        String id = draft(req, t, "ALIMTALK", "완료 시나리오", "10월 혜택");
        save(req, id, "C1", alimtalk("#{customer_name}님 포인트 안내", "자세히", "https://a.kr", "참여", "https://b.kr"));
        expect(201, req, post("/api/requests/" + id + "/contents"), null);
        save(req, id, "C2", alimtalk("두 번째 안내"));
        submit(req, id);
        assign(lead, id, List.of(revId, leadId), revId);
        String url = "/api/requests/" + id;

        // ---- permissions: only the primary reviewer completes, with the rowVersion
        assertThat(actions(rev, id)).contains("COMPLETE");
        assertThat(actions(lead, id)).doesNotContain("COMPLETE");
        expect(409, lead, post(url + "/complete"), Map.of("rowVersion", rowVersion(lead, id)));
        expect(409, req, post(url + "/complete"), Map.of("rowVersion", rowVersion(req, id)));
        expect(400, rev, post(url + "/complete"), Map.of());
        expect(409, rev, post(url + "/complete"), Map.of("rowVersion", rowVersion(rev, id) - 1));
        Login outsider = login(newTenant().requester());
        expect(404, outsider, post(url + "/complete"), Map.of("rowVersion", 1));

        // ---- co-review result: the lead leaves an opinion, then is removed from the assignment
        expect(200, lead, post(url + "/opinions"), Map.of("contentKey", "C1", "body", "표현 확인",
                "rowVersion", rowVersion(lead, id)));

        // ---- another reviewer's lock blocks completion
        expect(200, lead, post(url + "/contents/C1/lock"), null);
        JsonNode locked = complete(rev, id, 409);
        assertThat(locked.path("code").asString()).isEqualTo("LOCKED_BY_OTHER");
        assertThat(locked.path("message").asString()).isEqualTo("다른 검수자가 편집 중입니다. 저장과 잠금 해제 후 완료하세요");
        expect(204, lead, delete(url + "/contents/C1/lock"), null);

        Map<String, Object> change = new LinkedHashMap<>();
        change.put("reviewerIds", List.of(revId));
        change.put("primaryReviewerId", revId);
        change.put("reason", "단독 검수");
        change.put("handover", "의견 반영 필요");
        change.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, put(url + "/assignment"), change);
        JsonNode changes = getJson(req, url + "/assignment-changes");
        assertThat(changes).hasSize(1);
        assertThat(changes.get(0).path("fromReviewerIds").toString()).isEqualTo("[" + revId + "," + leadId + "]");
        assertThat(changes.get(0).path("toReviewerIds").toString()).isEqualTo("[" + revId + "]");
        assertThat(changes.get(0).path("fromPrimaryId").asLong()).isEqualTo(revId);
        assertThat(changes.get(0).path("reason").asString()).isEqualTo("단독 검수");
        assertThat(changes.get(0).path("handover").asString()).isEqualTo("의견 반영 필요");
        assertThat(changes.get(0).path("round").asInt()).isEqualTo(1);
        expect(404, outsider, get(url + "/assignment-changes"), null);
        JsonNode co = getJson(rev, url).path("coReviewers");
        assertThat(co).hasSize(2);
        assertThat(co.get(0).path("userId").asLong()).isEqualTo(revId);
        assertThat(co.get(0).path("current").asBoolean()).isTrue();
        assertThat(co.get(0).path("primary").asBoolean()).isTrue();
        assertThat(co.get(0).path("opinionCount").asInt()).isZero();
        assertThat(co.get(1).path("userId").asLong()).isEqualTo(leadId);
        assertThat(co.get(1).path("current").asBoolean()).isFalse();
        assertThat(co.get(1).path("rounds").toString()).isEqualTo("[{\"round\":1,\"count\":1}]");

        // ---- the final contents must pass the submit rules
        expect(200, rev, post(url + "/contents/C2/lock"), null);
        expect(200, rev, post(url + "/contents/C2/revisions"), Map.of("baseVersion", 1, "payload", alimtalk("")));
        JsonNode invalid = complete(rev, id, 400);
        assertThat(invalid.path("message").asString()).isEqualTo("최종 콘텐츠의 필수값과 연결값을 확인하세요");
        assertThat(strings(invalid.path("details"))).anyMatch(d -> d.startsWith("C2") && d.endsWith(": 본문"));
        expect(200, rev, post(url + "/contents/C2/lock"), null);
        expect(200, rev, post(url + "/contents/C2/revisions"), Map.of("baseVersion", 2,
                "payload", alimtalk("두 번째 안내 수정")));
        // my own lock does not block and is released by the completion
        expect(200, rev, post(url + "/contents/C2/lock"), null);

        // ---- completion: REVIEW_COMPLETED with the bundle
        JsonNode done = complete(rev, id, 200);
        assertThat(done.path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        assertThat(done.path("completedAt").isNull()).isFalse();
        assertThat(done.path("stageTimes").path("COMPLETED").isNull()).isFalse();
        JsonNode bundle = done.path("bundle");
        assertThat(bundle.path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        assertThat(bundle.path("completedBy").asLong()).isEqualTo(revId);
        assertThat(bundle.path("completedAt").asString()).isEqualTo(done.path("completedAt").asString());
        assertThat(bundle.path("variables").toString())
                .isEqualTo("[{\"key\":\"customer_name\",\"type\":\"TEXT\",\"value\":\"홍길동\"}]");
        assertThat(bundle.path("items")).hasSize(2);
        assertThat(bundle.path("items").get(0).path("contentKey").asString()).isEqualTo("C1");
        assertThat(bundle.path("items").get(0).path("version").asInt()).isEqualTo(1);
        assertThat(bundle.path("items").get(1).path("version").asInt()).isEqualTo(3);
        assertThat(bundle.path("items").get(1).path("payload").path("body").asString()).isEqualTo("두 번째 안내 수정");
        for (JsonNode c : done.path("contents")) {
            assertThat(c.path("lock").isNull()).isTrue();
        }
        assertThat(history(id, "검수 완료")).singleElement()
                .satisfies(h -> assertThat(h.get("detail")).isEqualTo("완료 묶음 고정"));
        assertThat(recipients(id, "FINAL", "완료 시나리오 요청이 검수 완료되었습니다")).containsExactly(req.userId());
        assertThat(actions(req, id)).containsExactlyInAnyOrder("EXPORT", "CLONE", "FOLLOW_UP");
        assertThat(actions(rev, id)).containsExactly("EXPORT");
        assertThat(actions(admin, id)).containsExactly("EXPORT");
        expect(409, rev, post(url + "/complete"), Map.of("rowVersion", rowVersion(rev, id)));
        assertThat(viewIds(rev, t, "MY_ASSIGNED_DONE")).contains(id);

        // ---- later variable changes do not touch the frozen values
        jdbc.update("UPDATE variables SET value = '김철수' WHERE project_id = ?", t.projectId());
        assertThat(getJson(req, url).path("bundle").path("variables").get(0).path("value").asString())
                .isEqualTo("홍길동");

        // ---- XLSX export
        MvcResult xlsx = send(rev, get(url + "/bundle/export.xlsx"), null);
        assertThat(xlsx.getResponse().getStatus()).isEqualTo(200);
        assertThat(xlsx.getResponse().getHeader("Content-Disposition"))
                .contains("filename*=UTF-8''" + id + "_%EC%99%84%EB%A3%8C%EB%B3%B8.xlsx");
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(body(xlsx)))) {
            Sheet sheet = wb.getSheet("완료본");
            assertThat(sheet.getLastRowNum()).isEqualTo(2);
            List<String> header = new ArrayList<>();
            sheet.getRow(0).forEach(c -> header.add(c.getStringCellValue()));
            assertThat(header).containsExactly("콘텐츠 식별자", "유형", "제목", "본문", "버튼명", "연결값", "변수", "완료 버전",
                    "요청 완료 상태", "완료일");
            Row c1 = sheet.getRow(1);
            assertThat(c1.getCell(0).getStringCellValue()).isEqualTo("C1");
            assertThat(c1.getCell(1).getStringCellValue()).isEqualTo("알림톡");
            assertThat(c1.getCell(3).getStringCellValue()).isEqualTo("#{customer_name}님 포인트 안내");
            assertThat(c1.getCell(4).getStringCellValue()).isEqualTo("자세히\n참여");
            assertThat(c1.getCell(5).getStringCellValue()).isEqualTo("https://a.kr\nhttps://b.kr");
            assertThat(c1.getCell(6).getStringCellValue()).isEqualTo("customer_name=홍길동");
            assertThat(c1.getCell(7).getStringCellValue()).isEqualTo("v1");
            assertThat(c1.getCell(8).getStringCellValue()).isEqualTo("검수 완료");
            assertThat(c1.getCell(9).getStringCellValue()).matches("\\d{4}-\\d{2}-\\d{2} \\(KST\\)");
            assertThat(sheet.getRow(2).getCell(6).getStringCellValue()).isEmpty();
            assertThat(sheet.getRow(2).getCell(7).getStringCellValue()).isEqualTo("v3");
        }
        assertThat(audits(id, "완료본 반출")).singleElement().satisfies(a -> {
            assertThat(a.get("detail")).isEqualTo("XLSX");
            assertThat(((Number) a.get("customer_id")).longValue()).isEqualTo(t.customerId());
            assertThat(((Number) a.get("actor_id")).longValue()).isEqualTo(revId);
        });

        // ---- ZIP without attachments: the manifest only
        MvcResult zip = send(req, get(url + "/bundle/attachments.zip"), null);
        assertThat(zip.getResponse().getStatus()).isEqualTo(200);
        assertThat(zip.getResponse().getContentType()).isEqualTo("application/zip");
        Map<String, byte[]> entries = unzip(body(zip));
        assertThat(entries.keySet()).containsExactly("완료_버전_명세.json");
        JsonNode manifest = json.readTree(new String(entries.get("완료_버전_명세.json"), StandardCharsets.UTF_8));
        assertThat(manifest.path("requestId").asString()).isEqualTo(id);
        assertThat(manifest.path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        assertThat(manifest.path("files")).isEmpty();
        assertThat(audits(id, "첨부 반출")).singleElement()
                .satisfies(a -> assertThat(a.get("detail")).isEqualTo("ZIP"));

        // ---- copy audit
        expect(204, req, post(url + "/bundle/copy-events"), Map.of("contentKey", "C1"));
        assertThat(audits(id, "완료본 반출")).extracting(a -> a.get("detail")).containsExactly("XLSX", "문안 복사 C1");
        expect(404, req, post(url + "/bundle/copy-events"), Map.of("contentKey", "C9"));
        expect(400, req, post(url + "/bundle/copy-events"), Map.of());
        expect(404, outsider, post(url + "/bundle/copy-events"), Map.of("contentKey", "C1"));

        // ---- exports need visibility and a final request
        expect(404, outsider, get(url + "/bundle/export.xlsx"), null);
        expect(404, outsider, get(url + "/bundle/attachments.zip"), null);
        String open = draft(req, t, "SMS", "진행 중", null);
        save(req, open, "C1", sms("본문"));
        submit(req, open);
        expect(409, req, get("/api/requests/" + open + "/bundle/export.xlsx"), null);
        expect(409, req, get("/api/requests/" + open + "/bundle/attachments.zip"), null);
        expect(409, req, post("/api/requests/" + open + "/follow-up"), Map.of());
        assertThat(audits(open, "완료본 반출")).isEmpty();
    }

    @Test
    void attachmentsZipStreamsFinalFilesWithTheManifestAndFollowUpsShareThem() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String id = draft(req, t, "FREEFORM", "첨부 완료", null);
        String c1 = "/api/requests/" + id + "/contents/C1";
        byte[] pdf = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);
        long fileId = read(upload(req, c1 + "/files", "약관.pdf", pdf, null)).path("id").asLong();
        expect(200, req, patch(c1 + "/files/" + fileId), Map.of("totalAmount", 10, "reviewAmount", 6,
                "rangeNote", "1~6쪽"));
        submit(req, id);
        assign(lead, id, List.of(rev.userId()), rev.userId());
        byte[] revised = "%PDF-1.7 revised".getBytes(StandardCharsets.US_ASCII);
        assertThat(upload(rev, c1 + "/files/" + fileId + "/versions", "약관 v2.pdf", revised, null).getResponse()
                .getStatus()).isEqualTo(201);
        complete(rev, id, 200);

        MvcResult zip = send(req, get("/api/requests/" + id + "/bundle/attachments.zip"), null);
        assertThat(zip.getResponse().getStatus()).isEqualTo(200);
        assertThat(zip.getResponse().getHeader("Content-Disposition"))
                .contains("filename*=UTF-8''" + id + "_%EC%B2%A8%EB%B6%80_%EC%99%84%EB%A3%8C%EB%B3%B8.zip");
        Map<String, byte[]> entries = unzip(body(zip));
        assertThat(entries.keySet()).containsExactly("C1/v2_약관 v2.pdf", "완료_버전_명세.json");
        assertThat(entries.get("C1/v2_약관 v2.pdf")).isEqualTo(revised);
        JsonNode file = json.readTree(new String(entries.get("완료_버전_명세.json"), StandardCharsets.UTF_8))
                .path("files").get(0);
        assertThat(file.path("contentKey").asString()).isEqualTo("C1");
        assertThat(file.path("fileName").asString()).isEqualTo("약관 v2.pdf");
        assertThat(file.path("fileVersion").asInt()).isEqualTo(2);
        assertThat(file.path("sizeBytes").asLong()).isEqualTo(revised.length);
        assertThat(file.path("sha256").asString())
                .isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(revised)));
        assertThat(file.path("reviewAmount").asInt()).isEqualTo(6);
        assertThat(file.path("rangeNote").asString()).isEqualTo("1~6쪽");

        // ---- a follow-up starts from the frozen file version (stored object shared)
        JsonNode follow = expect(201, req, post("/api/requests/" + id + "/follow-up"), Map.of());
        String fid = follow.path("id").asString();
        assertThat(follow.path("status").asString()).isEqualTo("DRAFT");
        assertThat(follow.path("title").asString()).isEqualTo("첨부 완료 후속");
        JsonNode copied = follow.path("contents").get(0).path("files").get(0);
        assertThat(copied.path("name").asString()).isEqualTo("약관 v2.pdf");
        assertThat(copied.path("version").asInt()).isEqualTo(1);
        assertThat(copied.path("reviewAmount").asInt()).isEqualTo(6);
        MvcResult download = send(req, get("/api/requests/" + fid + "/contents/C1/files/" + copied.path("id").asLong()
                + "/versions/1/download"), null);
        assertThat(download.getResponse().getStatus()).isEqualTo(200);
        assertThat(body(download)).isEqualTo(revised);

        // ---- a missing stored object refuses the whole ZIP (no audit)
        jdbc.update("UPDATE content_file_versions SET storage_key = NULL WHERE file_id = ? AND version = 2", fileId);
        int before = audits(id, "첨부 반출").size();
        JsonNode missing = expect(404, req, get("/api/requests/" + id + "/bundle/attachments.zip"), null);
        assertThat(missing.path("message").asString()).isEqualTo("약관 v2.pdf: 시연용 파일의 원본이 없습니다");
        assertThat(audits(id, "첨부 반출")).hasSize(before);
    }

    // ------------------------------------------------------------------ approval used

    @Test
    void approvalFlowBlocksWithoutEligibleApproverThenRevisesAndApproves() throws Exception {
        Tenant t = newTenant();
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        long revId = rev.userId();
        long leadId = lead.userId();
        String id = draft(req, t, "SMS", "승인 시나리오", null);
        save(req, id, "C1", sms("안내 본문"));
        submit(req, id);
        assign(lead, id, List.of(revId, leadId), revId);
        String url = "/api/requests/" + id;

        // ---- no eligible approver: 409, nothing changes, side effects committed
        long rv = rowVersion(rev, id);
        JsonNode blocked = complete(rev, id, 409);
        assertThat(blocked.path("code").asString()).isEqualTo("NO_ELIGIBLE_APPROVER");
        assertThat(blocked.path("message").asString()).isEqualTo("적격 승인자가 없습니다. 관리자에게 승인자 지정을 요청했습니다");
        JsonNode still = getJson(rev, url);
        assertThat(still.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(still.path("rowVersion").asLong()).isEqualTo(rv);
        assertThat(history(id, "승인 대기 전환 차단")).singleElement().satisfies(h -> {
            assertThat(h.get("detail")).isEqualTo("적격 승인자 없음");
            assertThat(((Number) h.get("actor_id")).longValue()).isEqualTo(revId);
        });
        assertThat(recipients(id, "INFO", "적격 승인자 지정 필요: 승인 시나리오")).containsExactly(admin.userId());
        assertThat(recipients(id, "INFO", "적격 승인자 부재로 완료 지연: 승인 시나리오"))
                .containsExactlyInAnyOrder(req.userId(), leadId);

        // an approver who is an assigned reviewer is not eligible either
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'APPROVER')",
                t.projectId(), leadId);
        complete(rev, id, 409);
        assertThat(history(id, "승인 대기 전환 차단")).hasSize(2);

        // ---- an eligible approver exists: APPROVAL_WAITING
        long approverId = addUser(t, "appr", "APPROVER");
        Login approver = login(email(t, "appr"));
        assertThat(getJson(rev, url).path("eligibleApproverIds").toString()).isEqualTo("[" + approverId + "]");
        JsonNode waiting = complete(rev, id, 200);
        assertThat(waiting.path("status").asString()).isEqualTo("APPROVAL_WAITING");
        assertThat(waiting.path("bundle").isNull()).isTrue();
        assertThat(waiting.path("completedAt").isNull()).isTrue();
        assertThat(history(id, "검수 완료")).singleElement()
                .satisfies(h -> assertThat(h.get("detail")).isEqualTo("주담당 검수 완료, 승인 대기로 전환"));
        assertThat(recipients(id, "APPROVAL", "승인 대기 요청이 있습니다: 승인 시나리오")).containsExactly(approverId);
        assertThat(actions(approver, id)).containsExactlyInAnyOrder("APPROVE", "REVISE", "EDIT_DUE");
        assertThat(actions(lead, id)).doesNotContain("APPROVE", "EDIT_DUE");
        assertThat(actions(rev, id)).doesNotContain("EDIT_CONTENT", "COMPLETE");
        assertThat(actions(admin, id)).doesNotContain("APPROVE", "EDIT_DUE");
        assertThat(viewIds(approver, t, "APPROVAL_QUEUE")).contains(id);
        assertThat(viewIds(approver, t, "APPROVAL_PENDING")).contains(id);
        assertThat(viewIds(lead, t, "APPROVAL_PENDING")).doesNotContain(id);
        assertThat(viewIds(approver, t, "APPROVAL_PROCESSED")).doesNotContain(id);
        expect(409, lead, post(url + "/approve"), Map.of("rowVersion", rowVersion(lead, id)));
        expect(409, rev, post(url + "/revise"), Map.of("reason", "x", "expectation", "y", "contentKey", "C1",
                "rowVersion", rowVersion(rev, id)));

        // ---- revision request: validation, then back to review in round 2
        String revise = url + "/revise";
        long arv = rowVersion(approver, id);
        assertThat(expect(400, approver, post(revise), Map.of("contentKey", "C1", "expectation", "y",
                "rowVersion", arv)).path("message").asString()).isEqualTo("이유을(를) 입력하세요");
        assertThat(expect(400, approver, post(revise), Map.of("reason", "오타", "contentKey", "C1",
                "rowVersion", arv)).path("message").asString()).isEqualTo("기대 내용을(를) 입력하세요");
        assertThat(expect(400, approver, post(revise), Map.of("reason", "오타", "expectation", "y",
                "rowVersion", arv)).path("message").asString()).isEqualTo("위치를 선택하세요");
        expect(404, approver, post(revise), Map.of("reason", "오타", "expectation", "y", "contentKey", "C9",
                "rowVersion", arv));
        JsonNode revised = expect(200, approver, post(revise), Map.of("reason", "맞춤법 오류", "contentKey", "C1",
                "location", "첫 문장", "expectation", "띄어쓰기 수정", "rowVersion", arv));
        assertThat(revised.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(revised.path("round").asInt()).isEqualTo(2);
        assertThat(revised.path("reviewerIds").toString()).isEqualTo("[" + revId + "," + leadId + "]");
        assertThat(revised.path("primaryReviewerId").asLong()).isEqualTo(revId);
        assertThat(history(id, "수정 요청")).singleElement().satisfies(h -> {
            assertThat(h.get("detail")).isEqualTo("사유: 맞춤법 오류\n위치: C1 첫 문장\n기대 내용: 띄어쓰기 수정");
            assertThat(h.get("round")).isEqualTo(1);
        });
        assertThat(history(id, "재검수 시작")).singleElement().satisfies(h -> {
            assertThat(h.get("detail")).isEqualTo("승인자 수정 요청으로 2차 검수 시작");
            assertThat(h.get("round")).isEqualTo(2);
        });
        assertThat(recipients(id, "INFO", "승인 시나리오 수정 요청: 맞춤법 오류"))
                .containsExactlyInAnyOrder(req.userId(), revId, leadId);
        assertThat(viewIds(approver, t, "APPROVAL_PROCESSED")).contains(id);
        assertThat(actions(rev, id)).contains("COMPLETE", "EDIT_CONTENT");

        // ---- complete again and approve
        complete(rev, id, 200);
        JsonNode approved = expect(200, approver, post(url + "/approve"),
                Map.of("rowVersion", rowVersion(approver, id)));
        assertThat(approved.path("status").asString()).isEqualTo("APPROVED");
        assertThat(approved.path("round").asInt()).isEqualTo(2);
        assertThat(approved.path("completedAt").isNull()).isFalse();
        assertThat(approved.path("stageTimes").path("APPROVED").isNull()).isFalse();
        assertThat(approved.path("bundle").path("status").asString()).isEqualTo("APPROVED");
        assertThat(approved.path("bundle").path("completedBy").asLong()).isEqualTo(approverId);
        assertThat(history(id, "승인 완료")).singleElement()
                .satisfies(h -> assertThat(h.get("detail")).isEqualTo("완료 묶음 고정"));
        assertThat(recipients(id, "FINAL", "승인 시나리오 요청이 승인 완료되었습니다"))
                .containsExactlyInAnyOrder(req.userId(), revId, leadId);
        assertThat(actions(approver, id)).containsExactly("EXPORT");
        expect(409, approver, post(url + "/approve"), Map.of("rowVersion", rowVersion(approver, id)));
        expect(409, approver, patch(url + "/schedule"), Map.of("dueDate", "2026-12-30", "reason", "x",
                "rowVersion", rowVersion(approver, id)));
        assertThat(viewIds(approver, t, "APPROVAL_PENDING")).doesNotContain(id);
        assertThat(viewIds(approver, t, "APPROVAL_QUEUE")).doesNotContain(id);
        assertThat(viewIds(approver, t, "APPROVAL_PROCESSED")).contains(id);

        MvcResult xlsx = send(approver, get(url + "/bundle/export.xlsx"), null);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(body(xlsx)))) {
            assertThat(wb.getSheet("완료본").getRow(1).getCell(8).getStringCellValue()).isEqualTo("승인 완료");
        }
    }

    // ------------------------------------------------------------------ follow-ups and archive

    @Test
    void followUpsKeepPerContentLineageInTheArchive() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login req2 = login(t.requester2());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        long revId = rev.userId();

        // ---- A: two contents, completed
        String a = draft(req, t, "SMS", "월 청구 안내", "9월 혜택");
        save(req, a, "C1", sms("#{customer_name}님 청구 금액 안내"));
        expect(201, req, post("/api/requests/" + a + "/contents"), null);
        save(req, a, "C2", sms("결제일 안내"));
        submit(req, a);
        assign(lead, a, List.of(revId), revId);
        complete(rev, a, 200);

        // ---- follow-up permissions
        expect(409, rev, post("/api/requests/" + a + "/follow-up"), Map.of());
        expect(404, req, post("/api/requests/" + a + "/follow-up"), Map.of("contentKey", "C9"));

        // ---- B: whole follow-up (by another requester), C: follow-up of C2 only
        JsonNode b = expect(201, req2, post("/api/requests/" + a + "/follow-up"), null);
        String bid = b.path("id").asString();
        assertThat(b.path("title").asString()).isEqualTo("월 청구 안내 후속");
        assertThat(b.path("campaign").asString()).isEqualTo("9월 혜택");
        assertThat(b.path("hopeDueDate").isNull()).isTrue();
        assertThat(b.path("requesterId").asLong()).isEqualTo(req2.userId());
        assertThat(b.path("parent").path("requestId").asString()).isEqualTo(a);
        assertThat(b.path("parent").path("contentKey").isNull()).isTrue();
        assertThat(b.path("parentRequestId").asString()).isEqualTo(a);
        assertThat(b.path("contents")).hasSize(2);
        assertThat(b.path("contents").get(1).path("payload").path("body").asString()).isEqualTo("결제일 안내");
        assertThat(b.path("contents").get(0).path("versions")).isEmpty();
        assertThat(strings(b.path("allowedActions"))).contains("EDIT_CONTENT", "SUBMIT");
        assertThat(history(bid, "후속 요청 작성")).singleElement()
                .satisfies(h -> assertThat(h.get("detail")).isEqualTo("원본 " + a + " C1 v1, C2 v1"));
        assertThat(jdbc.queryForList("SELECT CONCAT(content_key, '<-', parent_request_id, ':', parent_content_key) "
                + "FROM contents WHERE request_id = ? ORDER BY sort_order", String.class, bid))
                .containsExactly("C1<-" + a + ":C1", "C2<-" + a + ":C2");
        JsonNode c = expect(201, req, post("/api/requests/" + a + "/follow-up"), Map.of("contentKey", "C2"));
        String cid = c.path("id").asString();
        assertThat(c.path("parent").path("contentKey").asString()).isEqualTo("C2");
        assertThat(c.path("contents")).hasSize(1);
        assertThat(c.path("contents").get(0).path("key").asString()).isEqualTo("C1");
        assertThat(c.path("contents").get(0).path("payload").path("body").asString()).isEqualTo("결제일 안내");

        // ---- archive: two lines, follow-ups attached per content (drafts of others hidden)
        String archive = "/api/archive/contents?projectId=" + t.projectId();
        JsonNode lines = getJson(req, archive);
        assertThat(lines.path("page").path("totalElements").asLong()).isEqualTo(2);
        JsonNode c1Line = line(lines, a + ":C1");
        JsonNode c2Line = line(lines, a + ":C2");
        assertThat(c1Line.path("latest").path("requestId").asString()).isEqualTo(a);
        assertThat(c1Line.path("latest").path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        assertThat(c1Line.path("latest").path("resolvedText").asString()).isEqualTo("홍길동님 청구 금액 안내");
        assertThat(c1Line.path("latest").path("preview").asString()).isEqualTo("홍길동님 청구 금액 안내");
        assertThat(c1Line.path("latest").path("campaign").asString()).isEqualTo("9월 혜택");
        assertThat(c1Line.path("followUps")).isEmpty(); // B is someone else's draft
        assertThat(ids(c2Line.path("followUps"))).containsExactly(cid);
        assertThat(ids(line(getJson(req2, archive), a + ":C2").path("followUps"))).containsExactly(bid);
        assertThat(ids(line(getJson(admin, archive), a + ":C1").path("followUps"))).isEmpty();

        // ---- B is submitted and completed: B C1 becomes the latest of A:C1
        expect(200, req2, patch("/api/requests/" + bid), Map.of("hopeDueDate", "2026-12-24"));
        save(req2, bid, "C1", sms("#{customer_name}님 10월 청구 금액 안내"));
        submit(req2, bid);
        lines = getJson(req, archive);
        assertThat(ids(line(lines, a + ":C1").path("followUps"))).containsExactly(bid);
        assertThat(line(lines, a + ":C1").path("followUps").get(0).path("status").asString()).isEqualTo("WAITING");
        assign(lead, bid, List.of(revId), revId);
        jdbc.update("UPDATE variables SET value = '김철수' WHERE project_id = ?", t.projectId());
        complete(rev, bid, 200);
        jdbc.update("UPDATE completion_bundles SET completed_at = ? WHERE request_id = ?",
                LocalDateTime.of(2026, 9, 1, 3, 0), a);
        jdbc.update("UPDATE completion_bundles SET completed_at = ? WHERE request_id = ?",
                LocalDateTime.of(2026, 9, 30, 16, 0), bid); // 2026-10-01 01:00 KST

        lines = getJson(req, archive);
        assertThat(lines.path("page").path("totalElements").asLong()).isEqualTo(2);
        c1Line = lines.path("content").get(0);
        assertThat(c1Line.path("lineKey").asString()).isEqualTo(a + ":C1");
        assertThat(c1Line.path("latest").path("requestId").asString()).isEqualTo(bid);
        assertThat(c1Line.path("latest").path("resolvedText").asString()).isEqualTo("김철수님 10월 청구 금액 안내");
        assertThat(ids(c1Line.path("past"))).containsExactly(a);
        assertThat(c1Line.path("followUps")).isEmpty();
        c2Line = line(lines, a + ":C2");
        assertThat(c2Line.path("latest").path("requestId").asString()).isEqualTo(bid);
        assertThat(ids(c2Line.path("past"))).containsExactly(a);
        assertThat(ids(c2Line.path("followUps"))).containsExactly(cid);
        assertThat(strings(c2Line.path("campaigns"))).containsExactly("9월 혜택");

        // ---- a follow-up of the follow-up stays on the root line
        JsonNode d = expect(201, req, post("/api/requests/" + bid + "/follow-up"), Map.of("contentKey", "C1"));
        assertThat(ids(line(getJson(req, archive), a + ":C1").path("followUps")))
                .containsExactly(d.path("id").asString());

        // ---- filters (applied to the latest completion of each line)
        assertThat(keys(getJson(req, archive + "&q=" + enc("10월 청구"))))
                .containsExactly(a + ":C1");
        assertThat(keys(getJson(req, archive + "&q=" + enc("결제일")))).containsExactly(a + ":C2");
        assertThat(keys(getJson(req, archive + "&q=" + enc("월 청구 안내 후속")))).hasSize(2);
        assertThat(keys(getJson(req, archive + "&type=SMS"))).hasSize(2);
        assertThat(keys(getJson(req, archive + "&type=ALIMTALK"))).isEmpty();
        assertThat(keys(getJson(req, archive + "&status=APPROVED"))).isEmpty();
        assertThat(keys(getJson(req, archive + "&status=REVIEW_COMPLETED"))).hasSize(2);
        assertThat(keys(getJson(req, archive + "&campaign=" + enc("9월 혜택")))).hasSize(2);
        assertThat(keys(getJson(req, archive + "&campaign=" + enc("없음")))).isEmpty();
        assertThat(keys(getJson(req, archive + "&completedFrom=2026-10-01&completedTo=2026-10-01"))).hasSize(2);
        assertThat(keys(getJson(req, archive + "&completedTo=2026-09-30"))).isEmpty();
        JsonNode paged = getJson(req, archive + "&size=1&page=1");
        assertThat(paged.path("content")).hasSize(1);
        assertThat(paged.path("page").path("totalPages").asInt()).isEqualTo(2);
        assertThat(strings(getJson(req, "/api/archive/campaigns?projectId=" + t.projectId())))
                .containsExactly("9월 혜택");

        // ---- access
        Login outsider = login(newTenant().requester());
        expect(404, outsider, get(archive), null);
        expect(404, login(JUNG_OPERATOR), get(archive), null);
        expect(400, req, get("/api/archive/contents"), null);
        expect(400, req, get("/api/archive/campaigns"), null);
    }

    private static JsonNode line(JsonNode page, String lineKey) {
        for (JsonNode l : page.path("content")) {
            if (l.path("lineKey").asString().equals(lineKey)) {
                return l;
            }
        }
        throw new AssertionError("no line " + lineKey + " in " + page);
    }

    private static List<String> keys(JsonNode page) {
        List<String> out = new ArrayList<>();
        page.path("content").forEach(l -> out.add(l.path("lineKey").asString()));
        return out;
    }

    private static List<String> ids(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.path("requestId").asString()));
        return out;
    }

    private static String enc(String s) {
        return s; // MockMvc encodes the URL template itself
    }
}
