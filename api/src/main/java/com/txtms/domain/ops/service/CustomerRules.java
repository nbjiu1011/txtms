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

    /** Labels of letters/digits/inner hyphens; the last label is letters or an IDN (punycode) top-level domain. */
    private static final Pattern DOMAIN = Pattern.compile(
            "^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$");
    private static final Pattern SCHEME = Pattern.compile("^[a-z][a-z0-9+.-]*://");
    private static final Pattern PORT = Pattern.compile(":\\d+$");

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

    /**
     * The normalized company domain. People paste the domain in many shapes, so the host name is extracted first:
     * {@code @Example.CO.KR }, {@code admin@example.co.kr}, {@code https://www.example.co.kr:8080/path} and
     * {@code example.co.kr.} all become {@code example.co.kr}; a Korean domain becomes punycode
     * ({@code 예시.com} → {@code xn--vv4b11d.com}) because email addresses are compared in that form.
     */
    public static String domain(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        v = SCHEME.matcher(v).replaceFirst("");
        int at = v.lastIndexOf('@');
        if (at >= 0) {
            v = v.substring(at + 1);
        }
        for (char end : new char[] {'/', '?', '#'}) {
            int i = v.indexOf(end);
            if (i >= 0) {
                v = v.substring(0, i);
            }
        }
        v = PORT.matcher(v).replaceFirst("");
        while (v.endsWith(".")) {
            v = v.substring(0, v.length() - 1);
        }
        if (v.startsWith("www.")) {
            v = v.substring(4);
        }
        if (v.isEmpty()) {
            throw BusinessException.validation("domain", "회사 도메인을(를) 입력하세요");
        }
        try {
            v = java.net.IDN.toASCII(v).toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            throw BusinessException.validation("domain", DOMAIN_FORMAT);
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

    /** Duplicate domain wording: two customers cannot share a company domain (invitation domain checks rely on it). */
    public static String duplicateDomain(String existingCustomerName) {
        return existingCustomerName + "이(가) 같은 도메인을 쓰고 있습니다";
    }
}
