package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.variable.dto.VariableSnapshot;
import com.txtms.domain.variable.entity.VariableType;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Completion bundle snapshot rules, export text views and the XLSX rows. */
class BundleExportRulesTest {

    private final JsonMapper json = JsonMapper.builder().build();
    /** 2026-10-07 23:30 KST. */
    private static final Instant DONE = Instant.parse("2026-10-07T14:30:00Z");
    private static final Map<String, String> FROZEN = Map.of("customer_name", "홍길동", "points", "5,000",
            "unused", "x");

    private JsonNode tree(String s) {
        return json.readTree(s);
    }

    // ------------------------------------------------------------------ bundle snapshot

    @Test
    void bundleItemsFollowContentOrderAndKeepCurrentVersionPayloadAndFiles() {
        List<CompletionBundles.Item> items = CompletionBundles.items(List.of(
                new CompletionBundles.ContentState("C3", "셋째", 1, "{\"body\":\"c\"}", null, 7),
                new CompletionBundles.ContentState("C1", "첫째", 3, "{\"body\":\"a\"}", "[{\"id\":5}]", 2)));
        assertThat(items).extracting(CompletionBundles.Item::contentKey).containsExactly("C1", "C3");
        assertThat(items).extracting(CompletionBundles.Item::sortOrder).containsExactly(1, 2);
        assertThat(items.getFirst().version()).isEqualTo(3);
        assertThat(items.getFirst().filesJson()).isEqualTo("[{\"id\":5}]");
        assertThat(items.get(1).filesJson()).isEqualTo("[]");
    }

    @Test
    void variableSnapshotRoundTripsKeyTypeAndValue() {
        String snapshot = CompletionBundles.variablesJson(List.of(
                new VariableSnapshot("customer_name", VariableType.TEXT, "홍길동"),
                new VariableSnapshot("due", VariableType.DATE, "2026-10-31")), json);
        assertThat(snapshot).isEqualTo("[{\"key\":\"customer_name\",\"type\":\"TEXT\",\"value\":\"홍길동\"},"
                + "{\"key\":\"due\",\"type\":\"DATE\",\"value\":\"2026-10-31\"}]");
        assertThat(CompletionBundles.values(snapshot, json)).containsExactly(Map.entry("customer_name", "홍길동"),
                Map.entry("due", "2026-10-31"));
        assertThat(CompletionBundles.values("[]", json)).isEmpty();
    }

    @Test
    void labelsAndKstCompletionDate() {
        assertThat(CompletionBundles.statusLabel(RequestStatus.REVIEW_COMPLETED)).isEqualTo("검수 완료");
        assertThat(CompletionBundles.statusLabel(RequestStatus.APPROVED)).isEqualTo("승인 완료");
        assertThatThrownBy(() -> CompletionBundles.statusLabel(RequestStatus.IN_REVIEW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(CompletionBundles.completedDate(Instant.parse("2026-10-07T15:00:00Z"))).isEqualTo("2026-10-08");
        assertThat(CompletionBundles.completedDate(DONE)).isEqualTo("2026-10-07");
    }

    // ------------------------------------------------------------------ text views

    @Test
    void variableKeysComeFromEveryStringInOrderButNotImageKeys() {
        JsonNode p = tree("{\"cards\":[{\"title\":\"#{points}\",\"body\":\"#{customer_name}님 #{points}\","
                + "\"imageKey\":\"#{nope}\",\"buttonLink\":\"https://x.kr/#{code}\"}]}");
        assertThat(ContentTexts.variableKeys(p)).containsExactly("points", "customer_name", "code");
    }

    @Test
    void textFieldsPerType() {
        assertThat(ContentTexts.textFields(ContentType.ALIMTALK, tree(
                "{\"body\":\"b\",\"buttons\":[{\"name\":\"n1\",\"link\":\"l1\"}]}"))).containsExactly("b", "n1");
        assertThat(ContentTexts.textFields(ContentType.RCS, tree(
                "{\"cards\":[{\"title\":\"t\",\"body\":\"b\"}]}"))).containsExactly("t", "b");
        assertThat(ContentTexts.textFields(ContentType.FREEFORM, tree("{\"title\":\"t\",\"text\":\"x\"}")))
                .containsExactly("t", "x");
        assertThat(ContentTexts.resolve("#{customer_name}님 #{missing}", FROZEN)).isEqualTo("홍길동님 #{missing}");
    }

    // ------------------------------------------------------------------ XLSX rows

    @Test
    void alimtalkRowJoinsButtonsAndListsTheUsedVariableKeys() {
        JsonNode p = tree("{\"templateCode\":\"T\",\"body\":\"#{customer_name}님 #{points}P #{customer_name}\","
                + "\"buttons\":[{\"name\":\"자세히\",\"link\":\"https://a.kr\"},{\"name\":\"참여\",\"link\":\"https://b.kr\"}]}");
        List<String> row = BundleSheet.row(ContentType.ALIMTALK, "C1", "안내", 2, p, RequestStatus.APPROVED, DONE);
        assertThat(row).hasSize(10).containsExactly("C1", "알림톡", "안내", "#{customer_name}님 #{points}P #{customer_name}",
                "자세히\n참여", "https://a.kr\nhttps://b.kr", "customer_name\npoints", "v2", "승인 완료",
                "2026-10-07");
    }

    @Test
    void rcsRowJoinsCardBodiesAndKeepsOneButtonLinePerCard() {
        JsonNode p = tree("{\"cards\":[{\"title\":\"t1\",\"body\":\"카드1\",\"buttonName\":\"보기\",\"buttonLink\":\"https://a.kr\"},"
                + "{\"title\":\"t2\",\"body\":\"카드2 #{nope}\",\"buttonName\":\"\",\"buttonLink\":\"\"}]}");
        List<String> row = BundleSheet.row(ContentType.RCS, "C2", "캐러셀", 1, p, RequestStatus.REVIEW_COMPLETED,
                DONE);
        assertThat(row.get(1)).isEqualTo("RCS");
        assertThat(row.get(3)).isEqualTo("카드1\n카드2 #{nope}");
        assertThat(row.get(4)).isEqualTo("보기\n");
        assertThat(row.get(5)).isEqualTo("https://a.kr\n");
        assertThat(row.get(6)).isEqualTo("nope");
        assertThat(row.get(8)).isEqualTo("검수 완료");
        JsonNode noButtons = tree("{\"cards\":[{\"body\":\"a\"},{\"body\":\"b\"}]}");
        assertThat(BundleSheet.row(ContentType.RCS, "C3", "", 1, noButtons, RequestStatus.APPROVED, DONE)
                .get(4)).isEmpty();
    }

    @Test
    void smsAndFreeformRowsHaveNoButtons() {
        List<String> sms = BundleSheet.row(ContentType.SMS, "C1", "문자", 1,
                tree("{\"sender\":\"1588\",\"body\":\"#{points} 적립\",\"customerCenter\":true,\"optOut\":false}"),
                RequestStatus.APPROVED, DONE);
        assertThat(sms.subList(1, 7)).containsExactly("문자", "문자", "#{points} 적립", "", "", "points");
        List<String> free = BundleSheet.row(ContentType.FREEFORM, "C1", "고지", 1,
                tree("{\"title\":\"고지 제목\",\"text\":\"본문\"}"), RequestStatus.APPROVED, DONE);
        assertThat(free.get(1)).isEqualTo("자유입력형");
        assertThat(free.get(3)).isEqualTo("본문");
    }

    @Test
    void workbookHasTheHeaderAndOneRowPerItem() throws Exception {
        List<String> row = BundleSheet.row(ContentType.SMS, "C1", "문자", 1, tree("{\"body\":\"본문\"}"),
                RequestStatus.APPROVED, DONE);
        byte[] bytes = BundleSheet.workbook(List.of(row, row));
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheet("완료본");
            assertThat(sheet).isNotNull();
            assertThat(sheet.getLastRowNum()).isEqualTo(2);
            for (int i = 0; i < 10; i++) {
                assertThat(sheet.getRow(0).getCell(i).getStringCellValue()).isEqualTo(BundleSheet.HEADER.get(i));
            }
            assertThat(sheet.getRow(1).getCell(7).getStringCellValue()).isEqualTo("v1");
        }
    }

    @Test
    void zipNamesAreSanitizedAndDigestsAreHex() {
        assertThat(BundleExportService.safeName("a/b\\c:d*e?f\"g<h>i|j.pdf")).isEqualTo("a_b_c_d_e_f_g_h_i_j.pdf");
        assertThat(BundleExportService.sha256("abc".getBytes()))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void zipNamesCannotLeaveTheirFolder() {
        // zip slip: separators and control characters never survive, so "C1/v1_{name}" stays one entry in C1/
        assertThat(BundleExportService.safeName("../../etc/passwd")).isEqualTo(".._.._etc_passwd");
        assertThat(BundleExportService.safeName("..\\..\\win.ini")).isEqualTo(".._.._win.ini");
        assertThat(BundleExportService.safeName("a\nb\tc\u0000.txt")).isEqualTo("a_b_c_.txt");
        assertThat(BundleExportService.safeName("")).isEqualTo("_");
        assertThat(BundleExportService.safeName(null)).isEqualTo("_");
        assertThat(BundleExportService.safeName("약관 개정안.pdf")).isEqualTo("약관 개정안.pdf");
    }

    @Test
    void formulaLikeCellsStayTextWithTheQuotePrefix() throws Exception {
        assertThat(BundleSheet.formulaLike("=HYPERLINK(\"http://x\")")).isTrue();
        assertThat(BundleSheet.formulaLike("+82 10")).isTrue();
        assertThat(BundleSheet.formulaLike("-1+1")).isTrue();
        assertThat(BundleSheet.formulaLike("@SUM(A1)")).isTrue();
        assertThat(BundleSheet.formulaLike("\tcmd")).isTrue();
        assertThat(BundleSheet.formulaLike("일반 문안 = 값")).isFalse();
        assertThat(BundleSheet.formulaLike("")).isFalse();
        assertThat(BundleSheet.formulaLike(null)).isFalse();

        byte[] bytes = BundleSheet.workbook(List.of(List.of("C1", "알림톡", "=1+1", "-할인 안내", "@이벤트", "",
                "", "v1", "검수 완료", "2026-10-07")));
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0);
            var row = sheet.getRow(1);
            for (int i : new int[] {2, 3, 4}) {
                var cell = row.getCell(i);
                assertThat(cell.getCellType()).as("column %d is text, never a formula", i)
                        .isEqualTo(org.apache.poi.ss.usermodel.CellType.STRING);
                assertThat(cell.getCellStyle().getQuotePrefixed()).as("column %d quote prefix", i).isTrue();
            }
            assertThat(row.getCell(2).getStringCellValue()).as("value exported unchanged").isEqualTo("=1+1");
            assertThat(row.getCell(0).getCellStyle().getQuotePrefixed()).isFalse();
            assertThat(row.getCell(1).getCellStyle().getWrapText()).isTrue();
        }
    }
}
