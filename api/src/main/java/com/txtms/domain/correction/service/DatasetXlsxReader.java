package com.txtms.domain.correction.service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * Reads a dataset XLSX in the seven-column format of the engine specification (first sheet, header in row 1:
 * {@code rule_id, original_expr, recommended_expr, original_pattern, recommended_pattern, description_label,
 * description}, case and surrounding spaces ignored). Empty rows are skipped; row numbers are the real sheet rows.
 * Cells are read as displayed (a numeric rule id {@code 48.0} becomes {@code 48}, formulas give their cached
 * result); text keeps its spaces.
 */
public final class DatasetXlsxReader {

    public static final List<String> HEADER = List.of("rule_id", "original_expr", "recommended_expr",
            "original_pattern", "recommended_pattern", "description_label", "description");

    private DatasetXlsxReader() {
    }

    /**
     * @param maxRows data rows accepted before the file is refused ({@code LIMIT_EXCEEDED})
     */
    public static List<DatasetRuleValidator.Row> read(InputStream in, int maxRows) {
        DataFormatter formatter = new DataFormatter(Locale.ROOT);
        // Formula cells (the sample numbers rule ids with =ROW()-1) are read from their cached result, never
        // evaluated.
        formatter.setUseCachedValuesForFormulaCells(true);
        try (XSSFWorkbook wb = new XSSFWorkbook(in)) {
            if (wb.getNumberOfSheets() == 0) {
                throw columnsDiffer();
            }
            Sheet sheet = wb.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) {
                throw columnsDiffer();
            }
            for (int i = 0; i < HEADER.size(); i++) {
                if (!cell(formatter, header, i).strip().toLowerCase(Locale.ROOT).equals(HEADER.get(i))) {
                    throw columnsDiffer();
                }
            }
            List<DatasetRuleValidator.Row> rows = new ArrayList<>();
            Iterator<Row> it = sheet.rowIterator();
            while (it.hasNext()) {
                Row row = it.next();
                if (row.getRowNum() == 0) {
                    continue;
                }
                List<String> v = new ArrayList<>(HEADER.size());
                boolean any = false;
                for (int i = 0; i < HEADER.size(); i++) {
                    String value = cell(formatter, row, i);
                    any |= !value.isBlank();
                    v.add(value);
                }
                if (!any) {
                    continue;
                }
                if (rows.size() == maxRows) {
                    throw new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                            String.format("교정 규칙은 데이터셋당 최대 %,d개입니다", maxRows));
                }
                rows.add(new DatasetRuleValidator.Row(row.getRowNum() + 1, v.get(0), v.get(1), v.get(2), v.get(3),
                        v.get(4), v.get(5), v.get(6)));
            }
            return rows;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.FILE_REJECTED, "파일을 읽지 못했습니다. XLSX 형식인지 확인하세요");
        }
    }

    private static String cell(DataFormatter formatter, Row row, int index) {
        Cell c = row.getCell(index);
        return c == null ? "" : formatter.formatCellValue(c);
    }

    private static BusinessException columnsDiffer() {
        return new BusinessException(ErrorCode.VALIDATION_FAILED,
                "열 구조가 다릅니다. " + String.join(", ", HEADER) + " 7열 양식을 사용하세요");
    }
}
