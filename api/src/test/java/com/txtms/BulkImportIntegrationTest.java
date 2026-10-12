package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

class BulkImportIntegrationTest extends IntegrationTestBase {

    private static byte[] xlsx(String[]... rows) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("등록양식");
            for (int r = 0; r < rows.length; r++) {
                if (rows[r] == null) {
                    continue;
                }
                Row row = sheet.createRow(r);
                for (int c = 0; c < rows[r].length; c++) {
                    row.createCell(c).setCellValue(rows[r][c]);
                }
            }
            wb.write(out);
            return out.toByteArray();
        }
    }

    @Test
    void templatesHaveTheExpectedHeaders() throws Exception {
        Login kim = login(KIM_REQUESTER);
        MvcResult alim = send(kim, get("/api/content-types/ALIMTALK/bulk-template"), null);
        assertThat(alim.getResponse().getStatus()).isEqualTo(200);
        assertThat(alim.getResponse().getHeader("Content-Disposition"))
                .contains("filename*=UTF-8''%EC%95%8C%EB%A6%BC%ED%86%A1_%EB%93%B1%EB%A1%9D%EC%96%91%EC%8B%9D.xlsx");
        assertThat(header(alim.getResponse().getContentAsByteArray())).containsExactly("승인템플릿", "본문", "버튼명", "버튼링크");
        assertThat(header(send(kim, get("/api/content-types/SMS/bulk-template"), null).getResponse()
                .getContentAsByteArray())).containsExactly("발신자", "본문", "수신거부문구포함");
        expect(404, kim, get("/api/content-types/RCS/bulk-template"), null);
    }

    private static List<String> header(byte[] bytes) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(wb.getSheetAt(0).getSheetName()).isEqualTo("등록양식");
            List<String> values = new ArrayList<>();
            wb.getSheetAt(0).getRow(0).forEach(c -> values.add(c.getStringCellValue()));
            return values;
        }
    }

    @Test
    void alimtalkPreviewAndCommit() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "ALIMTALK"))
                .path("id").asString();
        String url = "/api/requests/" + id + "/bulk-import/preview";

        byte[] file = xlsx(
                new String[] {"승인 템플릿", "본문", "버튼명", "버튼 링크"},
                new String[] {"HB_POINT_01", "#{customer_name}님 포인트 안내", "자세히", "http://a.kr/p"},
                new String[] {"NOPE", "", "보기", ""},
                null,
                new String[] {"HB_POINT_01", "#{ghost} 안내", "", ""},
                new String[] {"HB_POINT_01", "가".repeat(1001), "", ""});
        MvcResult preview = upload(req, url, "rows.xlsx", file, null);
        assertThat(preview.getResponse().getStatus()).as(text(preview)).isEqualTo(200);
        JsonNode rows = read(preview).path("rows");
        assertThat(read(preview).path("limit").asInt()).isEqualTo(1000);
        assertThat(rows).hasSize(4);
        assertThat(rows.get(0).path("rowNumber").asInt()).isEqualTo(2);
        assertThat(rows.get(0).path("title").asString()).isEqualTo("대량 등록 2행");
        assertThat(rows.get(0).path("errors")).isEmpty();
        assertThat(rows.get(0).path("warnings")).isEmpty();
        assertThat(rows.get(0).path("payload").path("buttons").get(0).path("link").asString()).isEqualTo("http://a.kr/p");
        assertThat(rows.get(1).path("errors").toString())
                .isEqualTo("[\"승인 템플릿 없음\",\"본문 없음\",\"버튼명과 링크를 함께 입력\"]");
        assertThat(rows.get(2).path("rowNumber").asInt()).isEqualTo(5);
        assertThat(rows.get(2).path("errors").toString()).isEqualTo("[\"미등록 변수 ghost\"]");
        // channel spec overruns are warnings, not errors (the row can be added)
        assertThat(rows.get(3).path("errors")).isEmpty();
        assertThat(rows.get(3).path("warnings").toString()).isEqualTo("[\"본문 1,000자 초과 (1,001자)\"]");

        // structure and file errors reject the whole file
        assertThat(read(upload(req, url, "bad.xlsx", xlsx(new String[] {"발신자", "본문", "수신거부문구포함"}), null))
                .path("message").asString()).isEqualTo("열 구조가 다릅니다. 등록 양식을 사용하세요");
        MvcResult notXlsx = upload(req, url, "x.xlsx", "plain text".getBytes(), null);
        assertThat(notXlsx.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(notXlsx).path("message").asString()).isEqualTo("파일을 읽지 못했습니다. XLSX 형식인지 확인하세요");
        String[][] many = new String[1002][];
        many[0] = new String[] {"승인템플릿", "본문", "버튼명", "버튼링크"};
        for (int i = 1; i < many.length; i++) {
            many[i] = new String[] {"HB_POINT_01", "본문 " + i, "", ""};
        }
        assertThat(read(upload(req, url, "many.xlsx", xlsx(many), null)).path("message").asString())
                .isEqualTo("최대 1,000행까지 등록할 수 있습니다");

        // commit re-validates every row on the server
        JsonNode bad = expect(400, req, post("/api/requests/" + id + "/bulk-import/commit"), Map.of("rows", List.of(
                Map.of("title", "대량 등록 3행", "payload", rows.get(1).path("payload")))));
        assertThat(bad.path("details").get(0).asString())
                .isEqualTo("대량 등록 3행: 승인 템플릿 없음, 본문 없음, 버튼명과 링크를 함께 입력");
        JsonNode committed = expect(200, req, post("/api/requests/" + id + "/bulk-import/commit"), Map.of("rows",
                List.of(Map.of("title", "대량 등록 2행", "payload", rows.get(0).path("payload")),
                        Map.of("title", "대량 등록 6행", "payload", rows.get(3).path("payload")))));
        assertThat(committed.path("contents")).hasSize(3);
        JsonNode added = committed.path("contents").get(1);
        assertThat(added.path("key").asString()).isEqualTo("C2");
        assertThat(added.path("title").asString()).isEqualTo("대량 등록 2행");
        assertThat(added.path("payload").path("templateCode").asString()).isEqualTo("HB_POINT_01");
        assertThat(committed.path("contents").get(2).path("payload").path("body").asString()).hasSize(1001);
        List<String> actions = new ArrayList<>();
        getJson(req, "/api/requests/" + id + "/history").forEach(h -> actions.add(h.path("action").asString()
                + ":" + h.path("detail").asString()));
        assertThat(actions).endsWith("XLSX 대량 등록:2행 반영");

        // not the author: private draft
        expect(403, login(t.requester2()), post("/api/requests/" + id + "/bulk-import/commit"), Map.of("rows",
                List.of(Map.of("title", "x", "payload", rows.get(0).path("payload")))));
    }

    @Test
    void smsPreviewAndTypeRestriction() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String sms = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("id").asString();
        byte[] file = xlsx(
                new String[] {"발신자", "본문", "수신거부문구포함"},
                new String[] {"1588-0000", "안내 문자", "y"},
                new String[] {"02-1234", "안내", "예"},
                new String[] {"1588-0000", "a".repeat(1974), "Y"});
        JsonNode rows = read(upload(req, "/api/requests/" + sms + "/bulk-import/preview", "s.xlsx", file, null))
                .path("rows");
        assertThat(rows.get(0).path("errors")).isEmpty();
        assertThat(rows.get(0).path("payload").path("optOut").asBoolean()).isTrue();
        assertThat(rows.get(0).path("payload").path("customerCenter").asBoolean()).isFalse();
        assertThat(rows.get(1).path("errors").toString()).isEqualTo("[\"등록되지 않은 발신번호\",\"수신거부 값은 Y 또는 N\"]");
        // 1,974 + the opt-out line (27) = 2,001 bytes: a warning only
        assertThat(rows.get(2).path("errors")).isEmpty();
        assertThat(rows.get(2).path("warnings").toString()).isEqualTo("[\"LMS 2,000바이트 초과 (2,001바이트)\"]");
        assertThat(rows.get(0).path("warnings")).isEmpty();

        String freeform = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(),
                "type", "FREEFORM")).path("id").asString();
        assertThat(read(upload(req, "/api/requests/" + freeform + "/bulk-import/preview", "s.xlsx", file, null))
                .path("message").asString()).isEqualTo("알림톡·문자 요청만 XLSX로 등록할 수 있습니다");
    }
}
