package com.txtms.domain.auth.service;

import java.nio.charset.StandardCharsets;

/** At least 8 characters with two or more of: letters, digits, special characters. */
public final class PasswordPolicy {

    public static final String MESSAGE = "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다";
    public static final String TOO_LONG_MESSAGE = "비밀번호는 72바이트 이하여야 합니다";

    /** BCrypt only uses the first 72 bytes; longer input is rejected instead of silently truncated. */
    public static final int MAX_BYTES = 72;

    private PasswordPolicy() {
    }

    public static boolean satisfied(String password) {
        if (password == null || password.length() < 8) {
            return false;
        }
        boolean letter = false;
        boolean digit = false;
        boolean special = false;
        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
                letter = true;
            } else if (c >= '0' && c <= '9') {
                digit = true;
            } else {
                special = true;
            }
        }
        int kinds = (letter ? 1 : 0) + (digit ? 1 : 0) + (special ? 1 : 0);
        return kinds >= 2;
    }

    public static boolean tooLong(String password) {
        return password != null && password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
    }
}
