package com.txtms.domain.request.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.PageMargin;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
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

    /** Column widths in characters (Excel units: the width of the digit 0). */
    private static final int[] WIDTHS = {12, 11, 24, 60, 18, 36, 20, 10, 15, 12};

    /** Short code-like columns (identifier, type, version, status, date) are centred. */
    private static final boolean[] CENTER = {true, true, false, false, false, false, false, true, true, true};

    private static final String FONT = "맑은 고딕";
    private static final short FONT_POINTS = 10;
    /** One text line of {@link #FONT} at {@link #FONT_POINTS} pt, and the space above and below the text. */
    private static final float LINE_POINTS = 16.5f;
    private static final float PADDING_POINTS = 4f;
    /** Excel's maximum row height. */
    private static final float MAX_ROW_POINTS = 409f;

    private static final byte[] HEADER_FILL = rgb(0x1F, 0x2B, 0x4D);
    private static final byte[] HEADER_TEXT = rgb(0xFF, 0xFF, 0xFF);
    private static final byte[] BAND_FILL = rgb(0xF5, 0xF6, 0xF9);
    private static final byte[] GRID = rgb(0xCB, 0xD0, 0xD8);

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
     * Workbook with the header and the rows. Layout only — the values and their order are the contract: a navy
     * header row that stays in view (frozen) with filter buttons, fixed column widths, wrapped cells aligned to the
     * top, light banding and a thin grid, and row heights estimated from the wrapped text (Excel does not grow rows a
     * library wrote, so a long body would otherwise show one line). Printing fits the width on landscape A4 and
     * repeats the header on every page.
     * <p>
     * Every value is a text cell; a value that a spreadsheet would read as a formula ({@link #formulaLike}) also gets
     * the quote-prefix style (Excel's leading apostrophe), so it stays text even when the cell is edited and
     * re-entered (formula injection). The value itself is exported unchanged — it is the completed original.
     */
    public static byte[] workbook(List<List<String>> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.getProperties().getCoreProperties().setCreator("TX TMS");
            XSSFSheet sheet = wb.createSheet(SHEET_NAME);
            Styles styles = new Styles(wb);
            for (int c = 0; c < WIDTHS.length; c++) {
                sheet.setColumnWidth(c, WIDTHS[c] * 256);
            }

            Row header = sheet.createRow(0);
            header.setHeightInPoints(26);
            for (int c = 0; c < HEADER.size(); c++) {
                Cell cell = header.createCell(c);
                cell.setCellValue(HEADER.get(c));
                cell.setCellStyle(styles.header);
            }

            int r = 1;
            for (List<String> values : rows) {
                Row row = sheet.createRow(r);
                boolean band = r % 2 == 0;
                for (int c = 0; c < values.size(); c++) {
                    String value = values.get(c);
                    Cell cell = row.createCell(c);
                    cell.setCellValue(value);
                    cell.setCellStyle(styles.body(c < CENTER.length && CENTER[c], band, formulaLike(value)));
                }
                row.setHeightInPoints(rowHeight(values));
                r++;
            }

            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, r - 1), 0, HEADER.size() - 1));
            sheet.setRepeatingRows(CellRangeAddress.valueOf("1:1"));
            sheet.setFitToPage(true);
            PrintSetup print = sheet.getPrintSetup();
            print.setLandscape(true);
            print.setPaperSize(PrintSetup.A4_PAPERSIZE);
            print.setFitWidth((short) 1);
            print.setFitHeight((short) 0);
            sheet.setMargin(PageMargin.LEFT, 0.4);
            sheet.setMargin(PageMargin.RIGHT, 0.4);
            sheet.setMargin(PageMargin.TOP, 0.5);
            sheet.setMargin(PageMargin.BOTTOM, 0.6);
            sheet.getFooter().setCenter("&P / &N");

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

    /** Estimated height of a data row: the most wrapped lines among its cells. */
    static float rowHeight(List<String> values) {
        int lines = 1;
        for (int c = 0; c < values.size() && c < WIDTHS.length; c++) {
            lines = Math.max(lines, wrappedLines(values.get(c), WIDTHS[c]));
        }
        return Math.min(MAX_ROW_POINTS, lines * LINE_POINTS + PADDING_POINTS);
    }

    /** Lines a value takes in a column {@code width} characters wide (its line breaks plus wrapping). */
    static int wrappedLines(String value, int width) {
        if (value == null || value.isEmpty()) {
            return 1;
        }
        // tenths of a column unit, measured in Excel at 맑은 고딕 10 pt: a Hangul syllable is about 1.5 units, a
        // space half a unit, other characters one
        int usable = Math.max(1, width - 1) * 10;
        int lines = 0;
        for (String line : value.split("\n", -1)) {
            int units = 0;
            for (int i = 0; i < line.length(); i++) {
                char ch = line.charAt(i);
                units += wide(ch) ? 15 : ch == ' ' ? 5 : 10;
            }
            lines += Math.max(1, (units + usable - 1) / usable);
        }
        return lines;
    }

    /** Hangul, CJK and full-width forms are wide glyphs. */
    private static boolean wide(char c) {
        return (c >= 0x1100 && c <= 0x11FF) || (c >= 0x3000 && c <= 0x9FFF) || (c >= 0xAC00 && c <= 0xD7A3)
                || (c >= 0xFF00 && c <= 0xFFEF);
    }

    private static byte[] rgb(int r, int g, int b) {
        return new byte[] {(byte) r, (byte) g, (byte) b};
    }

    /** The few cell styles of the sheet, created once per workbook (Excel limits the number of styles). */
    private static final class Styles {

        final XSSFCellStyle header;
        private final XSSFWorkbook wb;
        private final XSSFFont bodyFont;
        private final Map<Integer, XSSFCellStyle> bodies = new HashMap<>();

        Styles(XSSFWorkbook wb) {
            this.wb = wb;
            XSSFFont headerFont = wb.createFont();
            headerFont.setFontName(FONT);
            headerFont.setFontHeightInPoints(FONT_POINTS);
            headerFont.setBold(true);
            headerFont.setColor(new XSSFColor(HEADER_TEXT, null));
            header = wb.createCellStyle();
            header.setFont(headerFont);
            header.setFillForegroundColor(new XSSFColor(HEADER_FILL, null));
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            grid(header);

            bodyFont = wb.createFont();
            bodyFont.setFontName(FONT);
            bodyFont.setFontHeightInPoints(FONT_POINTS);
        }

        XSSFCellStyle body(boolean center, boolean band, boolean quote) {
            int key = (center ? 1 : 0) | (band ? 2 : 0) | (quote ? 4 : 0);
            return bodies.computeIfAbsent(key, k -> {
                XSSFCellStyle s = wb.createCellStyle();
                s.setFont(bodyFont);
                s.setWrapText(true);
                s.setVerticalAlignment(VerticalAlignment.TOP);
                s.setAlignment(center ? HorizontalAlignment.CENTER : HorizontalAlignment.LEFT);
                s.setQuotePrefixed(quote);
                if (band) {
                    s.setFillForegroundColor(new XSSFColor(BAND_FILL, null));
                    s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                }
                grid(s);
                return s;
            });
        }

        private static void grid(XSSFCellStyle s) {
            XSSFColor line = new XSSFColor(GRID, null);
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
            s.setTopBorderColor(line);
            s.setBottomBorderColor(line);
            s.setLeftBorderColor(line);
            s.setRightBorderColor(line);
        }
    }
}
