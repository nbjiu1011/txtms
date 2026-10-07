package com.txtms.domain.request.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
     * One export row. The body keeps variable tokens; the variable column lists the variables the content uses as
     * {@code key=value} lines with the values frozen at completion (keys missing from the bundle are left out).
     */
    public static List<String> row(ContentType type, String contentKey, String title, int version, JsonNode payload,
            Map<String, String> frozenValues, RequestStatus status, Instant completedAt) {
        List<String> variables = new ArrayList<>();
        for (String key : ContentTexts.variableKeys(payload)) {
            if (frozenValues.containsKey(key)) {
                variables.add(key + "=" + frozenValues.get(key));
            }
        }
        return List.of(contentKey, ContentTypeService.label(type), title == null ? "" : title,
                ContentTexts.body(type, payload), ContentTexts.buttonNames(type, payload),
                ContentTexts.buttonLinks(type, payload), String.join("\n", variables), "v" + version,
                CompletionBundles.statusLabel(status), CompletionBundles.completedDate(completedAt));
    }

    /** Workbook with the header and the rows (multi-line cells wrap). */
    public static byte[] workbook(List<List<String>> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(SHEET_NAME);
            CellStyle wrap = wb.createCellStyle();
            wrap.setWrapText(true);
            write(sheet.createRow(0), HEADER, null);
            int r = 1;
            for (List<String> row : rows) {
                write(sheet.createRow(r++), row, wrap);
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not write the XLSX export", e);
        }
    }

    private static void write(Row row, List<String> values, CellStyle style) {
        for (int i = 0; i < values.size(); i++) {
            var cell = row.createCell(i);
            cell.setCellValue(values.get(i));
            if (style != null) {
                cell.setCellStyle(style);
            }
        }
    }
}
