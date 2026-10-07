package com.txtms.domain.ops.service;

import java.util.Locale;
import java.util.regex.Pattern;

import com.txtms.global.exception.BusinessException;

/**
 * Operator customer creation rules (pure, actions.md §2.14 {@code opsCustNew}): name required (100 characters), the
 * company domain lower-cased with a leading {@code @} removed and checked as a host name (labels of letters, digits
 * and inner hyphens, a final label of at least two letters, 253 characters at most).
 */
public final class CustomerRules {

    static final int NAME_MAX = 100;
    static final int DOMAIN_MAX = 253;
    static final int REASON_MAX = 500;
    static final String DOMAIN_FORMAT = "도메인 형식을 확인하세요";

    private static final Pattern DOMAIN = Pattern.compile(
            "^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$");

    private CustomerRules() {
    }

    public static String name(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation("name", "고객사 이름을(를) 입력하세요");
        }
        if (v.length() > NAME_MAX) {
            throw BusinessException.validation("name", "고객사 이름은 최대 100자입니다");
        }
        return v;
    }

    /** The normalized domain ({@code @Example.CO.KR } becomes {@code example.co.kr}). */
    public static String domain(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (v.startsWith("@")) {
            v = v.substring(1);
        }
        if (v.isEmpty()) {
            throw BusinessException.validation("domain", "회사 도메인을(를) 입력하세요");
        }
        if (v.length() > DOMAIN_MAX || !DOMAIN.matcher(v).matches()) {
            throw BusinessException.validation("domain", DOMAIN_FORMAT);
        }
        return v;
    }

    /** Deactivation reason: required, 500 characters at most. */
    public static String reason(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation("reason", "비활성 사유을(를) 입력하세요");
        }
        if (v.length() > REASON_MAX) {
            throw BusinessException.validation("reason", "비활성 사유는 최대 500자입니다");
        }
        return v;
    }

    /** Duplicate domain wording (client agreement 23 pending: duplicates are refused). */
    public static String duplicateDomain(String existingCustomerName) {
        return existingCustomerName + "이(가) 같은 도메인을 쓰고 있습니다. 중복 허용 여부는 협의 23 결정 전까지 막습니다";
    }
}
