package com.txtms.domain.correction.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Dataset import: the 7-column XLSX reader and the row validation. */
public class DatasetImportTest {

    private static DatasetRuleValidator.Row row(int n, String id, String oe, String re, String op, String rp) {
        return new DatasetRuleValidator.Row(n, id, oe, re, op, rp, "라벨", "설명");
    }

    @Test
    void validRowsAreNormalized() {
        List<CorrectionRule> rules = DatasetRuleValidator.validate(List.of(
                row(2, " 1 ", " 별 ", "별 ", null, null),
                row(3, "2", "", " ", "(\\d{4})-(\\d{2})", "\\1.\\2"),
                row(4, "3", "처리", "-", null, ""),
                new DatasetRuleValidator.Row(5, "4", "되요", "돼요", null, null, "  ", "  긴 설명\n둘째 줄  ")), 10);
        assertThat(rules.get(0)).isEqualTo(new CorrectionRule("1", " 별 ", "별 ", null, null, "라벨", "설명"));
        assertThat(rules.get(1).originalExpr()).isNull();
        assertThat(rules.get(1).recommendedExpr()).isNull();
        assertThat(rules.get(1).recommendedPattern()).isEqualTo("$1.$2");
        assertThat(rules.get(2).recommendedExpr()).isEqualTo("-");
        assertThat(rules.get(2).recommendedPattern()).isNull();
        assertThat(rules.get(3).descriptionLabel()).isNull();
        assertThat(rules.get(3).description()).isEqualTo("긴 설명\n둘째 줄");
    }

    @Test
    void rowErrorsAreReportedWithTheirRowNumbers() {
        assertThatThrownBy(() -> DatasetRuleValidator.validate(List.of(
                row(2, "", "a", "b", null, null),
                row(3, "x", "a", null, "b", null),
                row(4, "y", null, null, null, null),
                row(5, "x", "c", "d", null, null),
                row(6, "z", null, null, "(", "a"),
                row(7, "w", null, null, "(a)", "$3"),
                row(8, "v", "a", null, null, "x"),
                row(9, "u", "a".repeat(501), null, null, null),
                row(10, "t".repeat(51), "a", null, null, null)), 100))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
                    assertThat(e.getMessage()).isEqualTo("교정 규칙을 확인하세요");
                    assertThat(e.getDetails()).containsExactly(
                            "2행: rule_id를 입력하세요",
                            "3행: original_expr와 original_pattern 중 하나만 입력하세요",
                            "4행: original_expr와 original_pattern 중 하나만 입력하세요",
                            "5행: rule_id x이(가) 중복됩니다",
                            "6행: original_pattern 정규식 오류: Unclosed group (위치 1)",
                            "7행: recommended_pattern이 없는 그룹 $3을(를) 참조합니다",
                            "8행: original_expr 규칙의 권장 값은 recommended_expr에 입력하세요",
                            "9행: original_expr은(는) 최대 500자입니다",
                            "10행: rule_id는 최대 50자입니다");
                });
    }

    @Test
    void emptyAndTooLargeDatasets() {
        assertThatThrownBy(() -> DatasetRuleValidator.validate(List.of(), 10))
                .hasMessage("교정 규칙을 1개 이상 입력하세요");
        assertThatThrownBy(() -> DatasetRuleValidator.validate(List.of(row(1, "1", "a", null, null, null),
                row(2, "2", "b", null, null, null)), 1))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.LIMIT_EXCEEDED));
    }

    @Test
    void manyErrorsAreCapped() {
        List<DatasetRuleValidator.Row> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 120; i++) {
            rows.add(row(i + 2, "", "a", null, null, null));
        }
        assertThatThrownBy(() -> DatasetRuleValidator.validate(rows, 500))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getDetails()).hasSize(101);
                    assertThat(e.getDetails().getLast()).isEqualTo("외 20건");
                });
    }

    @Test
    void xlsxIsReadWithRealRowNumbers() throws IOException {
        byte[] file = xlsx(new Object[][] {
                {" Rule_ID ", "original_expr", "recommended_expr", "original_pattern", "recommended_pattern",
                        "description_label", "description"},
                {48.0, " 시 ", " 할 때 ", null, null, "어려운 한자어", "설명\n둘째 줄"},
                {null, null, null, null, null, null, null},
                {"x2", null, null, "([가-힣])번째", "$1 번째", "띄어쓰기", null}});
        List<DatasetRuleValidator.Row> rows = DatasetXlsxReader.read(new ByteArrayInputStream(file), 10);
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).rowNumber()).isEqualTo(2);
        assertThat(rows.get(0).ruleId()).isEqualTo("48");
        assertThat(rows.get(0).originalExpr()).isEqualTo(" 시 ");
        assertThat(rows.get(0).description()).isEqualTo("설명\n둘째 줄");
        assertThat(rows.get(1).rowNumber()).isEqualTo(4);
        assertThat(rows.get(1).originalPattern()).isEqualTo("([가-힣])번째");
    }

    @Test
    void xlsxStructureErrors() throws IOException {
        byte[] wrongHeader = xlsx(new Object[][] {{"id", "from", "to"}, {"1", "a", "b"}});
        assertThatThrownBy(() -> DatasetXlsxReader.read(new ByteArrayInputStream(wrongHeader), 10))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
                    assertThat(e.getMessage()).startsWith("열 구조가 다릅니다.");
                });
        assertThatThrownBy(() -> DatasetXlsxReader.read(
                new ByteArrayInputStream("not a workbook".getBytes(StandardCharsets.UTF_8)), 10))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(ErrorCode.FILE_REJECTED);
                    assertThat(e.getMessage()).isEqualTo("파일을 읽지 못했습니다. XLSX 형식인지 확인하세요");
                });
        byte[] three = xlsx(new Object[][] {DatasetXlsxReader.HEADER.toArray(), {"1", "a"}, {"2", "b"}, {"3", "c"}});
        assertThatThrownBy(() -> DatasetXlsxReader.read(new ByteArrayInputStream(three), 2))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.LIMIT_EXCEEDED));
    }

    /** A one-sheet workbook; numbers are written as numeric cells. */
    public static byte[] xlsx(Object[][] cells) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("rules");
            for (int r = 0; r < cells.length; r++) {
                Row row = sheet.createRow(r);
                for (int c = 0; c < cells[r].length; c++) {
                    Object v = cells[r][c];
                    if (v instanceof Number n) {
                        row.createCell(c).setCellValue(n.doubleValue());
                    } else if (v != null) {
                        row.createCell(c).setCellValue(v.toString());
                    }
                }
            }
            wb.write(out);
            return out.toByteArray();
        }
    }
}
