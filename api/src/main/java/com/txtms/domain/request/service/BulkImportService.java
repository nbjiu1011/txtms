package com.txtms.domain.request.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectTemplate;
import com.txtms.domain.request.dto.request.BulkCommitBody;
import com.txtms.domain.request.dto.response.BulkPreviewResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.file.FileRejectedException;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.request.validation.BulkRowValidator;
import com.txtms.domain.request.validation.PayloadNormalizer;
import com.txtms.domain.variable.service.VariableService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * XLSX bulk registration of Alimtalk and SMS contents: template download, preview with per-row errors, and commit
 * (rows validated again on the server, then appended as new contents).
 */
@Service
@Transactional
public class BulkImportService {

    private final RequestWriteSupport support;
    private final RequestCommandService commands;
    private final VariableService variables;
    private final BulkRowValidator rowValidator;
    private final PayloadNormalizer normalizer;
    private final JsonMapper json;
    private final AppProperties.Bulk limits;
    private final int maxContents;

    public BulkImportService(RequestWriteSupport support, RequestCommandService commands, VariableService variables,
            BulkRowValidator rowValidator, PayloadNormalizer normalizer, JsonMapper json, AppProperties properties) {
        this.support = support;
        this.commands = commands;
        this.variables = variables;
        this.rowValidator = rowValidator;
        this.normalizer = normalizer;
        this.json = json;
        this.limits = properties.bulk();
        this.maxContents = properties.content().maxContentsPerRequest();
    }

    /** Template file name and bytes: one sheet {@code 등록양식} with the header row only. */
    public record Template(String fileName, byte[] content) {
    }

    @Transactional(readOnly = true)
    public Template template(ContentType type) {
        requireBulkType(type);
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("등록양식");
            Row header = sheet.createRow(0);
            List<String> columns = BulkRowValidator.header(type);
            for (int i = 0; i < columns.size(); i++) {
                header.createCell(i).setCellValue(columns.get(i));
                sheet.setColumnWidth(i, 20 * 256);
            }
            wb.write(out);
            return new Template(ContentTypeService.label(type) + "_등록양식.xlsx", out.toByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public BulkPreviewResponse preview(AuthUser auth, String id, MultipartFile file) {
        Ctx ctx = context(auth, id);
        ContentType type = ctx.request().getType();
        if (file == null || file.isEmpty()) {
            throw new FileRejectedException("파일을 선택하세요");
        }
        if (file.getSize() > limits.maxFileSize().toBytes()) {
            throw new FileRejectedException("XLSX 최대 " + limits.maxFileSize().toMegabytes() + "MB");
        }
        List<RawRow> raw = read(file, type);
        Rules rules = rules(ctx);
        List<BulkPreviewResponse.Row> rows = new ArrayList<>();
        for (RawRow r : raw) {
            List<String> v = r.values();
            List<String> errors = new ArrayList<>();
            ObjectNode payload = json.createObjectNode();
            if (type == ContentType.ALIMTALK) {
                payload.put("templateCode", v.get(0));
                payload.put("body", v.get(1));
                var buttons = payload.putArray("buttons");
                if (!v.get(2).isEmpty() || !v.get(3).isEmpty()) {
                    buttons.addObject().put("name", v.get(2)).put("link", v.get(3));
                }
            } else {
                String optOut = v.get(2).toUpperCase(Locale.ROOT);
                payload.put("sender", v.get(0));
                payload.put("body", v.get(1));
                payload.put("customerCenter", false);
                payload.put("optOut", optOut.equals("Y"));
                if (!optOut.equals("Y") && !optOut.equals("N")) {
                    errors.add("수신거부 값은 Y 또는 N");
                }
            }
            errors.addAll(0, rowValidator.validate(type, payload, rules.templates(), rules.senders(),
                    rules.variables()));
            rows.add(new BulkPreviewResponse.Row(r.rowNumber(), "대량 등록 " + r.rowNumber() + "행",
                    json.writeValueAsString(payload), List.copyOf(errors)));
        }
        return new BulkPreviewResponse(rows, limits.maxRows());
    }

    /** Appends the selected rows as contents after validating every row again. */
    public RequestDetail commit(AuthUser auth, String id, BulkCommitBody body) {
        Ctx ctx = context(auth, id);
        support.checkRowVersion(ctx, body == null ? null : body.rowVersion(), false);
        if (body == null || body.rows() == null || body.rows().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "추가할 행을 선택하세요");
        }
        if (body.rows().size() > limits.maxRows()) {
            throw tooManyRows();
        }
        Request r = ctx.request();
        if (support.currentContents(r.getId()).size() + body.rows().size() > maxContents) {
            throw new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                    String.format("콘텐츠는 요청당 최대 %,d건입니다", maxContents));
        }
        Rules rules = rules(ctx);
        List<ObjectNode> payloads = new ArrayList<>();
        List<String> details = new ArrayList<>();
        for (int i = 0; i < body.rows().size(); i++) {
            BulkCommitBody.Row row = body.rows().get(i);
            ObjectNode payload = normalizer.normalize(r.getType(), row.payload());
            List<String> errors = rowValidator.validate(r.getType(), payload, rules.templates(), rules.senders(),
                    rules.variables());
            if (!errors.isEmpty()) {
                String label = row.title() == null || row.title().isBlank() ? (i + 1) + "번째 행" : row.title();
                details.add(label + ": " + String.join(", ", errors));
            }
            payloads.add(payload);
        }
        if (!details.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "선택한 행에 오류가 있습니다", null, details);
        }
        java.time.Instant now = support.now();
        for (int i = 0; i < payloads.size(); i++) {
            commands.createContent(r, body.rows().get(i).title(), payloads.get(i), now);
        }
        support.log(r, ctx.userId(), "XLSX 대량 등록", payloads.size() + "행 반영", null, null);
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ helpers

    private record RawRow(int rowNumber, List<String> values) {
    }

    private record Rules(Set<String> templates, Set<String> senders, Map<String, String> variables) {
    }

    private Ctx context(AuthUser auth, String id) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_REQUEST);
        if (ctx.request().getType() != ContentType.ALIMTALK && ctx.request().getType() != ContentType.SMS) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "알림톡·문자 요청만 XLSX로 등록할 수 있습니다");
        }
        return ctx;
    }

    private Rules rules(Ctx ctx) {
        Project p = ctx.project();
        Set<String> templates = new HashSet<>();
        p.getTemplates().stream().map(ProjectTemplate::getCode).forEach(templates::add);
        return new Rules(templates, new HashSet<>(p.getSenders()), variables.activeValues(p.getId()));
    }

    private static void requireBulkType(ContentType type) {
        if (type != ContentType.ALIMTALK && type != ContentType.SMS) {
            throw BusinessException.notFound();
        }
    }

    /** Non-empty data rows of the first sheet with their real row numbers; the header must match the template. */
    private List<RawRow> read(MultipartFile file, ContentType type) {
        List<String> header = BulkRowValidator.header(type);
        DataFormatter formatter = new DataFormatter(Locale.KOREA);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(file.getBytes()))) {
            if (wb.getNumberOfSheets() == 0) {
                throw columnsDiffer();
            }
            Sheet sheet = wb.getSheetAt(0);
            Row first = sheet.getRow(sheet.getFirstRowNum());
            if (first == null || first.getRowNum() != 0) {
                throw columnsDiffer();
            }
            for (int i = 0; i < header.size(); i++) {
                String value = cell(formatter, first, i).replaceAll("\\s", "");
                if (!value.equals(header.get(i))) {
                    throw columnsDiffer();
                }
            }
            List<RawRow> rows = new ArrayList<>();
            Iterator<Row> it = sheet.rowIterator();
            while (it.hasNext()) {
                Row row = it.next();
                if (row.getRowNum() == 0) {
                    continue;
                }
                List<String> values = new ArrayList<>();
                boolean any = false;
                for (int i = 0; i < header.size(); i++) {
                    String v = cell(formatter, row, i).trim();
                    any |= !v.isEmpty();
                    values.add(v);
                }
                if (!any) {
                    continue;
                }
                if (rows.size() == limits.maxRows()) {
                    throw tooManyRows();
                }
                rows.add(new RawRow(row.getRowNum() + 1, values));
            }
            return rows;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new FileRejectedException("파일을 읽지 못했습니다. XLSX 형식인지 확인하세요");
        }
    }

    private static String cell(DataFormatter formatter, Row row, int index) {
        Cell c = row.getCell(index);
        return c == null ? "" : formatter.formatCellValue(c);
    }

    private static BusinessException columnsDiffer() {
        return new BusinessException(ErrorCode.VALIDATION_FAILED, "열 구조가 다릅니다. 등록 양식을 사용하세요");
    }

    private BusinessException tooManyRows() {
        return new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                String.format("최대 %,d행까지 등록할 수 있습니다", limits.maxRows()));
    }
}
