package com.txtms.domain.request.validation;

/**
 * The single SMS length rule. Each code point above 127 counts 2 bytes, others 1 (EUC-KR approximation). The
 * customer-center and opt-out notice lines are appended on their own line when enabled and count towards the limit.
 */
public final class SmsBytes {

    /** LMS limit including notice lines. */
    public static final int LMS_LIMIT = 2000;

    /** Short message threshold (display only). */
    public static final int SMS_LIMIT = 90;

    private SmsBytes() {
    }

    public static int bytes(String s) {
        if (s == null) {
            return 0;
        }
        return s.codePoints().map(cp -> cp > 127 ? 2 : 1).sum();
    }

    public static int smsBytes(String body, boolean customerCenter, boolean optOut, String customerCenterLine,
            String optOutLine) {
        StringBuilder text = new StringBuilder(body == null ? "" : body);
        if (customerCenter) {
            text.append('\n').append(customerCenterLine);
        }
        if (optOut) {
            text.append('\n').append(optOutLine);
        }
        return bytes(text.toString());
    }
}
