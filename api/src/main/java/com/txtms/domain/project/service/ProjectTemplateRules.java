package com.txtms.domain.project.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import com.txtms.domain.project.entity.ProjectTemplate;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * Validation of a project's Alimtalk templates set by the operator (pure): the registered templates that the submit
 * check compares contents with (contract §12 {@code PUT /api/ops/projects/{id}/templates}). Values are trimmed; the
 * stored codes are what contents must match.
 */
public final class ProjectTemplateRules {

    public static final int MAX_TEMPLATES = 100;
    static final int CODE_MAX = 50;
    static final int NAME_MAX = 100;

    /** Template code: letters, digits, {@code _} and {@code -} (e.g. {@code HB_POINT_01}). */
    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9_-]+$");

    private ProjectTemplateRules() {
    }

    /** One template as sent by the client. */
    public record TemplateInput(String code, String name) {
    }

    /** The validated templates in the given order; the first problem fails with {@code VALIDATION_FAILED}. */
    public static List<ProjectTemplate> templates(List<TemplateInput> input) {
        if (input == null) {
            throw BusinessException.validation("templates", "템플릿 목록을 보내세요");
        }
        if (input.size() > MAX_TEMPLATES) {
            throw new BusinessException(ErrorCode.LIMIT_EXCEEDED, "템플릿은 최대 " + MAX_TEMPLATES + "개입니다");
        }
        List<ProjectTemplate> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < input.size(); i++) {
            TemplateInput t = input.get(i);
            String field = "templates." + i;
            String code = t == null || t.code() == null ? "" : t.code().trim();
            String name = t == null || t.name() == null ? "" : t.name().trim();
            if (code.isEmpty()) {
                throw BusinessException.validation(field + ".code", "템플릿 코드를 입력하세요");
            }
            if (code.length() > CODE_MAX) {
                throw BusinessException.validation(field + ".code", "템플릿 코드는 최대 " + CODE_MAX + "자입니다");
            }
            if (!CODE.matcher(code).matches()) {
                throw BusinessException.validation(field + ".code", "템플릿 코드는 영문, 숫자, _, -만 쓸 수 있습니다");
            }
            if (name.isEmpty()) {
                throw BusinessException.validation(field + ".name", "템플릿 이름을 입력하세요");
            }
            if (name.length() > NAME_MAX) {
                throw BusinessException.validation(field + ".name", "템플릿 이름은 최대 " + NAME_MAX + "자입니다");
            }
            // the stored key is case-insensitive (the database uses a _ci collation)
            if (!seen.add(code.toLowerCase(Locale.ROOT))) {
                throw BusinessException.validation(field + ".code", "템플릿 코드 " + code + "이(가) 중복됩니다");
            }
            out.add(new ProjectTemplate(code, name));
        }
        return out;
    }

    /** Audit wording of a template list: codes joined, {@code 없음} when empty. */
    public static String templateLabel(List<ProjectTemplate> templates) {
        return templates.isEmpty() ? "없음"
                : String.join(", ", templates.stream().map(ProjectTemplate::getCode).toList());
    }
}
