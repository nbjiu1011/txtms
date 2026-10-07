package com.txtms.domain.variable.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import com.txtms.domain.request.validation.Links;
import com.txtms.domain.variable.entity.VariableType;

/** Variable key format and typed value checks. Each check returns the user-facing message when it fails. */
public final class VariableRules {

    public static final Pattern KEY = Pattern.compile("^[a-z0-9_]+$");
    public static final int MAX_KEY_LENGTH = 64;
    public static final int MAX_VALUE_LENGTH = 1000;

    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    private VariableRules() {
    }

    public static Optional<String> checkKey(String key) {
        if (key == null || !KEY.matcher(key).matches() || key.length() > MAX_KEY_LENGTH) {
            return Optional.of("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
        }
        return Optional.empty();
    }

    public static Optional<String> checkValue(VariableType type, String value) {
        String v = value == null ? "" : value;
        if (v.length() > MAX_VALUE_LENGTH) {
            return Optional.of(String.format("값은 최대 %,d자입니다", MAX_VALUE_LENGTH));
        }
        return switch (type) {
            case TEXT -> Optional.empty();
            case NUMBER -> number(v) ? Optional.empty() : Optional.of("정수 또는 소수를 입력하세요");
            case DATE -> date(v) ? Optional.empty() : Optional.of("유효한 YYYY-MM-DD 날짜를 입력하세요");
            case LINK -> {
                if (Links.valid(v, Map.of())) {
                    yield Optional.empty();
                }
                yield Optional.of(Links.parsable(v) ? "HTTP/HTTPS 링크를 입력하세요" : "유효한 링크를 입력하세요");
            }
        };
    }

    static boolean number(String v) {
        if (v.isBlank()) {
            return false;
        }
        try {
            new BigDecimal(v.trim());
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    static boolean date(String v) {
        if (!DATE.matcher(v).matches()) {
            return false;
        }
        try {
            LocalDate.parse(v);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
