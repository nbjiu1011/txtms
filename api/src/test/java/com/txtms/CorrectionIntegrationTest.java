package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.txtms.domain.correction.service.DatasetImportTest;
import com.txtms.domain.correction.service.DatasetXlsxReader;
import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Text correction (M4): operator datasets (JSON and XLSX) → assignment → requester check of a draft buffer →
 * apply/restore history → suggestion; unassigned type, permissions, and the contract §14 additions (submit pre-check,
 * {@code nextSubmitRound}, {@code expectedSavedAt} null semantics). Writes happen in isolated tenants.
 */
class CorrectionIntegrationTest extends IntegrationTestBase {

    private JsonNode create(Login login, long projectId, String type) throws Exception {
        return expect(201, login, post("/api/requests"), Map.of("projectId", projectId, "type", type));
    }

    private static Map<String, Object> rule(String id, String oe, String re, String op, String rp, String label) {
        Map<String, Object> m = new HashMap<>();
        m.put("ruleId", id);
        m.put("originalExpr", oe);
        m.put("recommendedExpr", re);
        m.put("originalPattern", op);
        m.put("recommendedPattern", rp);
        m.put("descriptionLabel", label);
        m.put("description", label + " 설명");
        return m;
    }

    private static Map<String, Object> check(String key, Object payload, boolean hasFiles) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("contentKey", key);
        item.put("payload", payload);
        item.put("hasFiles", hasFiles);
        return Map.of("contents", List.of(item));
    }

    private List<String> history(Login login, String id) throws Exception {
        List<String> out = new ArrayList<>();
        getJson(login, "/api/requests/" + id + "/history")
                .forEach(h -> out.add(h.path("action").asString() + "|" + h.path("detail").asString()));
        return out;
    }

    private int auditCount(String action, Long customerId) {
        return customerId == null
                ? jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ?", Integer.class, action)
                : jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                        Integer.class, action, customerId);
    }

    private int nextVersion(Login operator, String scope) throws Exception {
        int max = 0;
        for (JsonNode d : getJson(operator, "/api/ops/datasets")) {
            if (d.path("scope").asString().equals(scope)) {
                max = Math.max(max, d.path("version").asInt());
            }
        }
        return max + 1;
    }

    private MvcResult uploadDataset(Login login, String scope, byte[] xlsx) throws Exception {
        var b = MockMvcRequestBuilders.multipart("/api/ops/datasets")
                .file(new MockMultipartFile("file", "rules.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx))
                .param("scope", scope)
                .header("Authorization", "Bearer " + login.accessToken());
        return mvc.perform(b).andReturn();
    }

    @Test
    void datasetsAssignmentsCheckEventsAndSuggestions() throws Exception {
        Tenant t = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login req = login(t.requester());
        String id = create(req, t.projectId(), "ALIMTALK").path("id").asString();
        Map<String, Object> payload = Map.of("templateCode", "HB_POINT_01",
                "body", "포인트가 적립 되요. 첫번째 이벤트 처리 안내",
                "buttons", List.of(Map.of("name", "자세히보기", "link", "https://a.test")));

        // ---- not assigned yet
        assertThat(getJson(req, "/api/requests/" + id + "/corrections/dataset").toString())
                .isEqualTo("{\"assigned\":false,\"datasetLabel\":null}");
        JsonNode missing = expect(409, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false));
        assertThat(missing.path("code").asString()).isEqualTo("DATASET_NOT_ASSIGNED");
        assertThat(missing.path("message").asString())
                .isEqualTo("유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요");

        // ---- operator registers a dataset (JSON); row errors and scope rules first
        JsonNode rowErrors = expect(400, operator, post("/api/ops/datasets"), Map.of("scope", "ALIMTALK",
                "rules", List.of(rule("1", "a", null, null, null, "x"), rule("1", null, null, "(", null, "x"))));
        assertThat(rowErrors.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(rowErrors.path("details").toString())
                .isEqualTo("[\"2행: rule_id 1이(가) 중복됩니다\"]");
        assertThat(expect(400, operator, post("/api/ops/datasets"), Map.of("scope", "COMMON",
                "rules", List.of(rule("1", "a", "b", null, null, "x")))).path("fieldErrors").get(0).path("field")
                .asString()).isEqualTo("scope");
        assertThat(expect(403, req, post("/api/ops/datasets"), Map.of("scope", "ALIMTALK",
                "rules", List.of(rule("1", "a", "b", null, null, "x")))).path("message").asString())
                .isEqualTo("운영 담당자 권한이 필요합니다");

        int version = nextVersion(operator, "ALIMTALK");
        int seeded = auditCount("교정 데이터셋 시드 등록", null);
        JsonNode created = expect(201, operator, post("/api/ops/datasets"), Map.of("scope", "ALIMTALK",
                "rules", List.of(
                        rule("R1", "되요", "돼요", null, null, "한글 맞춤법 준수"),
                        rule("R2", null, null, "([가-힣])번째", "\\1 번째", "띄어쓰기"),
                        rule("R3", "처리", "-", null, null, "군더더기 표현"),
                        rule("R4", "자세히보기", "자세히 보기", null, null, "띄어쓰기"),
                        rule("R5", "자세히보기", "더 보기", null, null, "권장 표현"))));
        long datasetId = created.path("id").asLong();
        assertThat(created.path("scope").asString()).isEqualTo("ALIMTALK");
        assertThat(created.path("version").asInt()).isEqualTo(version);
        assertThat(created.path("ruleCount").asInt()).isEqualTo(5);
        assertThat(auditCount("교정 데이터셋 시드 등록", null)).isEqualTo(seeded + 1);
        JsonNode detail = getJson(operator, "/api/ops/datasets/" + datasetId);
        assertThat(detail.path("rules")).hasSize(5);
        assertThat(detail.path("rules").get(1).path("recommendedPattern").asString()).isEqualTo("$1 번째");
        assertThat(detail.path("rules").get(2).path("recommendedExpr").asString()).isEqualTo("-");

        // ---- XLSX registration (7 columns); sheet row numbers in errors
        byte[] xlsx = DatasetImportTest.xlsx(new Object[][] {DatasetXlsxReader.HEADER.toArray(),
                {1, "무료수신거부", "무료 수신거부", null, null, "띄어쓰기", "설명"},
                {2, null, null, "(\\d{4})-(\\d{2})", "$1.$2", "혼용표기", null}});
        MvcResult sms = uploadDataset(operator, "SMS", xlsx);
        assertThat(sms.getResponse().getStatus()).isEqualTo(201);
        assertThat(read(sms).path("ruleCount").asInt()).isEqualTo(2);
        byte[] badRows = DatasetImportTest.xlsx(new Object[][] {DatasetXlsxReader.HEADER.toArray(),
                {1, "a", "b", null, null, "x", null}, {2, null, null, "[", null, "x", null}});
        JsonNode bad = read(uploadDataset(operator, "SMS", badRows));
        assertThat(bad.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(bad.path("details").get(0).asString()).startsWith("3행: original_pattern 정규식 오류");
        assertThat(read(uploadDataset(operator, "SMS", DatasetImportTest.xlsx(new Object[][] {{"a", "b"}})))
                .path("message").asString()).startsWith("열 구조가 다릅니다.");
        assertThat(uploadDataset(req, "SMS", xlsx).getResponse().getStatus()).isEqualTo(403);
        assertThat(getJson(operator, "/api/ops/datasets").findValues("id").stream().map(JsonNode::asLong))
                .contains(datasetId, read(sms).path("id").asLong());

        // ---- assignment: scope must match, change clears the confirmation, audited
        String path = "/api/ops/customers/" + t.customerId() + "/dataset-assignments/";
        assertThat(expect(400, operator, put(path + "ALIMTALK"), Map.of("datasetId", read(sms).path("id").asLong()))
                .path("message").asString()).isEqualTo("알림톡 데이터셋만 배정할 수 있습니다");
        expect(400, operator, put(path + "COMMON"), Map.of("datasetId", datasetId));
        expect(404, operator, put(path + "EMAIL"), Map.of("datasetId", datasetId));
        expect(403, req, put(path + "ALIMTALK"), Map.of("datasetId", datasetId));
        JsonNode assigned = expect(200, operator, put(path + "ALIMTALK"), Map.of("datasetId", datasetId));
        assertThat(assigned.path("datasetId").asLong()).isEqualTo(datasetId);
        assertThat(assigned.path("checkedAt").isNull()).isTrue();
        JsonNode confirmed = expect(200, operator, post(path + "ALIMTALK/confirm"), null);
        assertThat(confirmed.path("checkedBy").asLong()).isEqualTo(operator.userId());
        assertThat(auditCount("유효 데이터셋 배정", t.customerId())).isEqualTo(1);
        assertThat(auditCount("유효 데이터셋 확인", t.customerId())).isEqualTo(1);
        assertThat(getJson(operator, "/api/ops/dataset-assignments").toString())
                .contains("\"customerId\":" + t.customerId() + ",\"type\":\"ALIMTALK\",\"datasetId\":" + datasetId);
        expect(403, req, get("/api/ops/dataset-assignments"), null);

        // ---- requester checks the draft buffer
        String label = "알림톡 v" + version;
        assertThat(getJson(req, "/api/requests/" + id + "/corrections/dataset").toString())
                .isEqualTo("{\"assigned\":true,\"datasetLabel\":\"" + label + "\"}");
        JsonNode result = expect(200, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("results").get(0);
        assertThat(result.path("contentKey").asString()).isEqualTo("C1");
        assertThat(result.path("datasetLabel").asString()).isEqualTo(label);
        assertThat(result.path("variablesRevision").asInt()).isEqualTo(0);
        assertThat(result.path("excluded").asBoolean()).isFalse();
        assertThat(result.path("checkedAt").asString()).isNotEmpty();
        JsonNode groups = result.path("groups");
        assertThat(groups).hasSize(4);
        assertThat(groups.get(0).toString()).isEqualTo("{\"id\":\"body:8:10\",\"field\":\"body\",\"start\":8,\"end\":10,"
                + "\"matchedText\":\"되요\",\"options\":[{\"ruleId\":\"R1\",\"recommended\":\"돼요\","
                + "\"descriptionLabel\":\"한글 맞춤법 준수\",\"description\":\"한글 맞춤법 준수 설명\"}]}");
        assertThat(groups.get(1).path("matchedText").asString()).isEqualTo("첫번째");
        assertThat(groups.get(1).path("options").get(0).path("recommended").asString()).isEqualTo("첫 번째");
        assertThat(groups.get(2).path("matchedText").asString()).isEqualTo("처리");
        assertThat(groups.get(2).path("options").get(0).has("recommended")).isTrue();
        assertThat(groups.get(2).path("options").get(0).path("recommended").isNull()).isTrue();
        assertThat(groups.get(3).path("id").asString()).isEqualTo("buttons.0.name:0:5");
        assertThat(groups.get(3).path("options")).hasSize(2);
        // the buffer shape is validated like an autosave
        JsonNode shape = expect(400, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", Map.of("text", "x"), false));
        assertThat(shape.path("fieldErrors").get(0).path("field").asString()).isEqualTo("contents.0.payload.text");
        expect(404, req, post("/api/requests/" + id + "/corrections/check"), check("C9", payload, false));
        expect(400, req, post("/api/requests/" + id + "/corrections/check"), Map.of("contents", List.of()));

        // ---- apply / restore history, suggestion
        expect(204, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "되요", "after", "돼요"));
        expect(204, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "RESTORE", "field", "buttons.0.name", "before", "자세히 보기", "after", "자세히보기"));
        expect(400, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "UNDO", "field", "body", "before", "a", "after", "b"));
        expect(400, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "buttons.0.link", "before", "a", "after", "b"));
        assertThat(expect(400, req, post("/api/requests/" + id + "/corrections/suggestions"), Map.of("contentKey",
                "C1", "matchedText", "처리", "ruleIds", List.of("R3"), "body", " ")).path("message").asString())
                .isEqualTo("건의 이유을(를) 입력하세요");
        expect(204, req, post("/api/requests/" + id + "/corrections/suggestions"), Map.of("contentKey", "C1",
                "matchedText", "처리", "ruleIds", List.of("R3"), "body", "업무 용어라 유지가 필요합니다"));
        assertThat(history(req, id)).contains("교정 적용|body: 되요 → 돼요", "교정 복원|buttons.0.name: 자세히 보기 → 자세히보기",
                "교정 건의|C1: 업무 용어라 유지가 필요합니다");
        assertThat(jdbc.queryForObject("SELECT CONCAT(content_key, '|', matched_text, '|', rule_ids, '|', body) "
                + "FROM correction_suggestions WHERE request_id = ?", String.class, id))
                .isEqualTo("C1|처리|[\"R3\"]|업무 용어라 유지가 필요합니다");
        assertThat(jdbc.queryForObject("SELECT suggested_expr FROM correction_suggestions WHERE request_id = ?",
                String.class, id)).as("suggestedExpr is optional").isNull();

        // ---- contract §14.4: ruleId on events (history detail), suggestedExpr on suggestions, variablesRevision
        expect(204, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "첫번째", "after", "첫 번째", "ruleId", " R2 "));
        assertThat(history(req, id)).contains("교정 적용|body: 첫번째 → 첫 번째 (R2)");
        assertThat(expect(400, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "a", "after", "b", "ruleId", "R".repeat(51)))
                .path("fieldErrors").get(0).path("field").asString()).isEqualTo("ruleId");
        expect(204, req, post("/api/requests/" + id + "/corrections/suggestions"), Map.of("contentKey", "C1",
                "matchedText", "되요", "ruleIds", List.of("R1"), "body", "다른 표현 제안", "suggestedExpr", "됩니다"));
        assertThat(jdbc.queryForList("SELECT suggested_expr FROM correction_suggestions WHERE request_id = ? "
                + "AND suggested_expr IS NOT NULL", String.class, id)).containsExactly("됩니다");
        assertThat(expect(400, req, post("/api/requests/" + id + "/corrections/suggestions"), Map.of("contentKey",
                "C1", "matchedText", "되요", "body", "길다", "suggestedExpr", "가".repeat(201))).path("message")
                .asString()).isEqualTo("제안 표현은 최대 200자입니다");
        long project = jdbc.queryForObject("SELECT project_id FROM requests WHERE id = ?", Long.class, id);
        int revision = jdbc.queryForObject("SELECT variables_revision FROM projects WHERE id = ?", Integer.class,
                project);
        assertThat(getJson(req, "/api/requests/" + id).path("variablesRevision").asInt()).isEqualTo(revision);
        expect(201, req, post("/api/projects/" + project + "/variables"), Map.of("key", "rev_probe_" + System.nanoTime()
                % 100000, "type", "TEXT", "value", "x", "description", "신선도"));
        assertThat(getJson(req, "/api/requests/" + id).path("variablesRevision").asInt()).isEqualTo(revision + 1);

        // ---- permissions: other customers and operators 404, someone else's draft 403
        Login other = login(KIM_REQUESTER);
        expect(404, other, post("/api/requests/" + id + "/corrections/check"), check("C1", payload, false));
        expect(404, operator, post("/api/requests/" + id + "/corrections/check"), check("C1", payload, false));
        expect(404, operator, get("/api/requests/" + id + "/corrections/dataset"), null);
        Login req2 = login(t.requester2());
        assertThat(expect(403, req2, post("/api/requests/" + id + "/corrections/check"), check("C1", payload, false))
                .path("code").asString()).isEqualTo("DRAFT_PRIVATE");
        expect(403, req2, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "a", "after", "b"));

        // ---- in review: any viewer may run the read-only check (the unassigned lead too); events still need
        // EDIT_CONTENT
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "적립 안내", "hopeDueDate", "2026-12-20",
                "purpose", "p", "target", "t", "background", "b"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", payload));
        JsonNode submitted = expect(200, req, post("/api/requests/" + id + "/submit"),
                Map.of("rowVersion", getJson(req, "/api/requests/" + id).path("rowVersion").asLong()));
        Login lead = login(t.lead());
        expect(200, lead, post("/api/requests/" + id + "/assignment"), Map.of("rowVersion",
                submitted.path("rowVersion").asLong(), "reviewerIds", List.of(userId(t.reviewer())),
                "dueDate", "2026-12-20"));
        Login reviewer = login(t.reviewer());
        assertThat(expect(200, reviewer, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("results").get(0).path("groups")).hasSize(4);
        assertThat(expect(200, lead, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("results").get(0).path("groups")).hasSize(4);
        assertThat(expect(200, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("results")).hasSize(1);
        expect(409, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "되요", "after", "돼요"));
        expect(409, lead, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "body", "before", "되요", "after", "돼요"));
        assertThat(getJson(lead, "/api/requests/" + id + "/corrections/dataset").path("datasetLabel").asString())
                .isEqualTo(label);

        // ---- unassign → the next check is refused again
        expect(204, operator, delete(path + "ALIMTALK"), null);
        assertThat(auditCount("유효 데이터셋 해제", t.customerId())).isEqualTo(1);
        expect(404, operator, delete(path + "ALIMTALK"), null);
        assertThat(expect(409, reviewer, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("code").asString()).isEqualTo("DATASET_NOT_ASSIGNED");
    }

    @Test
    void freeFormWithAttachmentsIsExcluded() throws Exception {
        Tenant t = newTenant();
        Login operator = login(JUNG_OPERATOR);
        Login req = login(t.requester());
        long dataset = expect(201, operator, post("/api/ops/datasets"), Map.of("scope", "FREEFORM",
                "rules", List.of(rule("F1", "하였습니다", "했습니다", null, null, "간결한 표현")))).path("id").asLong();
        expect(200, operator, put("/api/ops/customers/" + t.customerId() + "/dataset-assignments/FREEFORM"),
                Map.of("datasetId", dataset));
        String id = create(req, t.projectId(), "FREEFORM").path("id").asString();
        Map<String, Object> payload = Map.of("title", "안내", "text", "변경하였습니다");
        JsonNode plain = expect(200, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, false)).path("results").get(0);
        assertThat(plain.path("excluded").asBoolean()).isFalse();
        assertThat(plain.path("groups").get(0).path("id").asString()).isEqualTo("text:2:7");
        JsonNode withFiles = expect(200, req, post("/api/requests/" + id + "/corrections/check"),
                check("C1", payload, true)).path("results").get(0);
        assertThat(withFiles.path("excluded").asBoolean()).isTrue();
        assertThat(withFiles.path("groups")).isEmpty();
        // a stored attachment excludes the content even when the buffer says otherwise
        assertThat(upload(req, "/api/requests/" + id + "/contents/C1/files", "a.pdf",
                RequestAuthoringIntegrationTest.PDF, null).getResponse().getStatus()).isEqualTo(201);
        assertThat(expect(200, req, post("/api/requests/" + id + "/corrections/check"), check("C1", payload, false))
                .path("results").get(0).path("excluded").asBoolean()).isTrue();
        assertThat(expect(400, req, post("/api/requests/" + id + "/corrections/events"), Map.of("contentKey", "C1",
                "action", "APPLY", "field", "text", "before", "하였습니다", "after", "했습니다")).path("message")
                .asString()).isEqualTo("첨부파일이 있는 자유입력형은 교정을 적용할 수 없습니다");
    }

    @Test
    void demoSeedDatasetsAndAssignments() throws Exception {
        Login operator = login(JUNG_OPERATOR);
        long hanbit = customerId("hanbitcard.co.kr");
        long dodam = customerId("dodamlife.com");
        Map<String, JsonNode> byKey = new HashMap<>();
        for (JsonNode a : getJson(operator, "/api/ops/dataset-assignments")) {
            byKey.put(a.path("customerId").asLong() + ":" + a.path("type").asString(), a);
        }
        for (String type : List.of("ALIMTALK", "SMS", "RCS", "FREEFORM")) {
            assertThat(byKey.get(hanbit + ":" + type).path("checkedAt").isNull()).as(type).isFalse();
        }
        assertThat(byKey.get(dodam + ":ALIMTALK").path("checkedAt").isNull()).isFalse();
        assertThat(byKey.get(dodam + ":SMS").path("checkedAt").isNull()).isTrue();
        assertThat(byKey.get(dodam + ":RCS").path("checkedAt").isNull()).isTrue();
        assertThat(byKey).doesNotContainKeys(dodam + ":FREEFORM", hanbit + ":COMMON", dodam + ":COMMON");
        long alimtalk = byKey.get(hanbit + ":ALIMTALK").path("datasetId").asLong();
        JsonNode rules = getJson(operator, "/api/ops/datasets/" + alimtalk).path("rules");
        assertThat(rules).hasSize(56);
        assertThat(rules.get(47).path("originalPattern").asString()).startsWith("(지급|수령|신청|해지");

        // REQ-2609-101 C1 (in review, assigned reviewer 박지훈) shows the prototype corrections
        Login park = login(PARK_REVIEWER);
        JsonNode detail = getJson(park, "/api/requests/REQ-2609-101");
        JsonNode c1 = detail.path("contents").get(0);
        JsonNode groups = expect(200, park, post("/api/requests/REQ-2609-101/corrections/check"),
                check("C1", c1.path("payload"), false)).path("results").get(0).path("groups");
        List<String> matched = new ArrayList<>();
        groups.forEach(g -> matched.add(g.path("matchedText").asString()));
        assertThat(matched).contains("되요", "클릭");
        assertThat(detail.path("nextSubmitRound").asInt()).isEqualTo(1);
    }

    @Test
    void submitCheckAndAutosaveConflictSemantics() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = create(req, t.projectId(), "SMS").path("id").asString();
        JsonNode created = getJson(req, "/api/requests/" + id);
        assertThat(created.path("nextSubmitRound").asInt()).isEqualTo(1);

        // ---- submit pre-check: same validation as submit, no state change
        JsonNode precheck = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(precheck.path("ok").asBoolean()).isFalse();
        assertThat(precheck.path("details").get(0).asString()).isEqualTo("요청 정보: 제목");
        assertThat(precheck.path("fieldErrors").get(0).path("field").asString()).isEqualTo("title");
        assertThat(getJson(req, "/api/requests/" + id).path("rowVersion").asLong())
                .isEqualTo(created.path("rowVersion").asLong());
        expect(403, login(t.requester2()), post("/api/requests/" + id + "/submit-check"), null);
        expect(404, login(KIM_REQUESTER), post("/api/requests/" + id + "/submit-check"), null);

        // ---- expectedSavedAt: null = "never saved" (first save passes, a second "never saved" save conflicts)
        Map<String, Object> neverSaved = new HashMap<>();
        neverSaved.put("payload", Map.of("sender", "1588-0000", "body", "첫 저장"));
        neverSaved.put("expectedSavedAt", null);
        JsonNode first = expect(200, req, put("/api/requests/" + id + "/contents/C1"), neverSaved);
        assertThat(first.path("savedAt").asString()).isNotEmpty();
        assertThat(expect(409, req, put("/api/requests/" + id + "/contents/C1"), neverSaved).path("code")
                .asString()).isEqualTo("VERSION_CONFLICT");
        expect(200, req, put("/api/requests/" + id + "/contents/C1"),
                Map.of("payload", Map.of("sender", "1588-0000", "body", "키 생략은 검사하지 않음")));
        String savedAt = getJson(req, "/api/requests/" + id).path("contents").get(0).path("savedAt").asString();
        expect(200, req, put("/api/requests/" + id + "/contents/C1"),
                Map.of("payload", Map.of("sender", "1588-0000", "body", "값 일치"), "expectedSavedAt", savedAt));

        // ---- complete the request: the pre-check passes and submit still works
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "안내", "hopeDueDate", "2026-12-20",
                "purpose", "p", "target", "t", "background", "b"));
        JsonNode ok = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(ok.toString()).isEqualTo("{\"ok\":true,\"details\":[],\"fieldErrors\":[]}");
        expect(200, req, post("/api/requests/" + id + "/submit"),
                Map.of("rowVersion", getJson(req, "/api/requests/" + id).path("rowVersion").asLong()));
        expect(409, req, post("/api/requests/" + id + "/submit-check"), null);
    }
}
