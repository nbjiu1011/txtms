package com.txtms.domain.request.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.request.entity.RequestStatus;

import tools.jackson.databind.JsonNode;

/** The completed-content XLSX export: ten fixed columns, one row per bundle item (pure apart from POI). */
public final class BundleSheet {

    public static final String SHEET_NAME = "완료본";

    public static final List<String> HEADER = List.of("콘텐츠 식별자", "유형", "제목", "본문", "버튼명", "연결값", "변수",
            "완료 버전", "요청 완료 상태", "완료일");

    private BundleSheet() {
    }

    /**
     * One export row. The body keeps variable tokens; the variable column lists the variable keys the content uses,
     * one per line in order of first use (client decision 2026-10-12, contract §17.6).
     */
    public static List<String> row(ContentType type, String contentKey, String title, int version, JsonNode payload,
            RequestStatus status, Instant completedAt) {
        return List.of(contentKey, ContentTypeService.label(type), title == null ? "" : title,
                ContentTexts.body(type, payload), ContentTexts.buttonNames(type, payload),
                ContentTexts.buttonLinks(type, payload), String.join("\n", ContentTexts.variableKeys(payload)),
                "v" + version, CompletionBundles.statusLabel(status), CompletionBundles.completedDate(completedAt));
    }

    /**
     * Workbook with the header and the rows (multi-line cells wrap). Every value is a text cell; a value that a
     * spreadsheet would read as a formula ({@link #formulaLike}) also gets the quote-prefix style (Excel's leading
     * apostrophe), so it stays text even when the cell is edited and re-entered (formula injection). The value itself
     * is exported unchanged — it is the completed original.
     */
    public static byte[] workbook(List<List<String>> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(SHEET_NAME);
            CellStyle wrap = wb.createCellStyle();
            wrap.setWrapText(true);
            CellStyle wrapText = wb.createCellStyle();
            wrapText.setWrapText(true);
            wrapText.setQuotePrefixed(true);
            write(sheet.createRow(0), HEADER, null, null);
            int r = 1;
            for (List<String> row : rows) {
                write(sheet.createRow(r++), row, wrap, wrapText);
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not write the XLSX export", e);
        }
    }

    /** Starts with a character spreadsheets treat as the start of a formula or command ({@code = + - @}, tab, CR). */
    public static boolean formulaLike(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        char c = value.charAt(0);
        return c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r';
    }

    private static void write(Row row, List<String> values, CellStyle style, CellStyle textStyle) {
        for (int i = 0; i < values.size(); i++) {
            var cell = row.createCell(i);
            String value = values.get(i);
            cell.setCellValue(value);
            CellStyle s = textStyle != null && formulaLike(value) ? textStyle : style;
            if (s != null) {
                cell.setCellStyle(s);
            }
        }
    }
}
