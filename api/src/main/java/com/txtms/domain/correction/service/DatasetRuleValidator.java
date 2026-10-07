package com.txtms.domain.correction.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.txtms.domain.correction.engine.CorrectionEngine;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.correction.engine.ReplacementTemplate;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * Validation and normalization of dataset rows before a new dataset version is stored (pure). Every row error is
 * reported as {@code "{행}행: {문구}"} in {@code details} of one {@code VALIDATION_FAILED}; nothing is stored when any
 * row fails.
 * <ul>
 * <li>{@code rule_id}: required, at most 50 characters, unique in the dataset (spaces around it are removed).</li>
 * <li>Exactly one of {@code original_expr} / {@code original_pattern}; an expression rule recommends with
 * {@code recommended_expr}, a pattern rule with {@code recommended_pattern}. An empty or {@code -} recommendation is
 * a description-only rule.</li>
 * <li>Expressions keep their spaces (a leading or trailing space is part of the match); whitespace-only cells count
 * as empty.</li>
 * <li>Patterns must compile with {@link java.util.regex.Pattern}; a replacement may only refer to existing groups.
 * {@code \N} references are stored as {@code $N}.</li>
 * <li>Lengths: expressions and patterns 500, label 100, description 5,000 characters.</li>
 * </ul>
 */
public final class DatasetRuleValidator {

    public static final String SUMMARY = "교정 규칙을 확인하세요";
    static final int MAX_DETAILS = 100;
    static final int RULE_ID_MAX = 50;
    static final int EXPR_MAX = 500;
    static final int LABEL_MAX = 100;
    static final int DESCRIPTION_MAX = 5000;

    /** One input row; {@code rowNumber} is the number shown in errors (XLSX row, or 1-based JSON index). */
    public record Row(int rowNumber, String ruleId, String originalExpr, String recommendedExpr,
            String originalPattern, String recommendedPattern, String descriptionLabel, String description) {
    }

    private DatasetRuleValidator() {
    }

    public static List<CorrectionRule> validate(List<Row> rows, int maxRules) {
        if (rows == null || rows.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "교정 규칙을 1개 이상 입력하세요");
        }
        if (rows.size() > maxRules) {
            throw new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                    String.format("교정 규칙은 데이터셋당 최대 %,d개입니다", maxRules));
        }
        List<String> errors = new ArrayList<>();
        List<CorrectionRule> rules = new ArrayList<>(rows.size());
        Set<String> ids = new HashSet<>();
        for (Row row : rows) {
            List<String> rowErrors = new ArrayList<>();
            CorrectionRule rule = normalize(row, rowErrors);
            if (rule.ruleId() != null && !ids.add(rule.ruleId())) {
                rowErrors.add("rule_id " + rule.ruleId() + "이(가) 중복됩니다");
            }
            if (rowErrors.isEmpty()) {
                try {
                    CorrectionEngine.validate(rule);
                } catch (IllegalArgumentException e) {
                    rowErrors.add(e.getMessage());
                }
            }
            rowErrors.forEach(e -> errors.add(row.rowNumber() + "행: " + e));
            rules.add(rule);
        }
        if (!errors.isEmpty()) {
            List<String> details = errors.size() <= MAX_DETAILS ? errors
                    : new ArrayList<>(errors.subList(0, MAX_DETAILS));
            if (errors.size() > MAX_DETAILS) {
                details.add(String.format("외 %,d건", errors.size() - MAX_DETAILS));
            }
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, SUMMARY, null, List.copyOf(details));
        }
        return List.copyOf(rules);
    }

    private static CorrectionRule normalize(Row row, List<String> errors) {
        String ruleId = trimmed(row.ruleId());
        if (ruleId == null) {
            errors.add("rule_id를 입력하세요");
        } else if (ruleId.length() > RULE_ID_MAX) {
            errors.add("rule_id는 최대 " + RULE_ID_MAX + "자입니다");
        }
        String originalExpr = raw(row.originalExpr(), "original_expr", EXPR_MAX, errors);
        String recommendedExpr = raw(row.recommendedExpr(), "recommended_expr", EXPR_MAX, errors);
        String originalPattern = raw(row.originalPattern(), "original_pattern", EXPR_MAX, errors);
        String recommendedPattern = ReplacementTemplate.normalize(
                raw(row.recommendedPattern(), "recommended_pattern", EXPR_MAX, errors));
        String label = trimmed(row.descriptionLabel());
        if (label != null && label.length() > LABEL_MAX) {
            errors.add("description_label은 최대 " + LABEL_MAX + "자입니다");
        }
        String description = trimmed(row.description());
        if (description != null && description.length() > DESCRIPTION_MAX) {
            errors.add(String.format("description은 최대 %,d자입니다", DESCRIPTION_MAX));
        }
        if (CorrectionRule.present(originalExpr) == CorrectionRule.present(originalPattern)) {
            errors.add("original_expr와 original_pattern 중 하나만 입력하세요");
        }
        return new CorrectionRule(ruleId, originalExpr, recommendedExpr, originalPattern, recommendedPattern, label,
                description);
    }

    /** Expression or pattern cell: kept as written (spaces included); whitespace-only is empty. */
    private static String raw(String value, String column, int max, List<String> errors) {
        if (!CorrectionRule.present(value)) {
            return null;
        }
        if (value.length() > max) {
            errors.add(column + "은(는) 최대 " + max + "자입니다");
        }
        return value;
    }

    private static String trimmed(String value) {
        if (value == null) {
            return null;
        }
        String t = value.strip();
        return t.isEmpty() ? null : t;
    }
}
