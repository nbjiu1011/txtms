package com.txtms.domain.request.validation;

import java.nio.charset.Charset;
import java.nio.charset.CharsetEncoder;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The single SMS length rule: the text is measured as EUC-KR (KS X 1001). ASCII counts 1 byte, every other code
 * point 2 bytes. Code points EUC-KR cannot represent (e.g. 똠, emoji) also count 2 bytes and are reported by
 * {@link #unsupported(String)}. The customer-center and opt-out notice lines are appended on their own line when
 * enabled and count towards the length.
 */
public final class SmsBytes {

    /** BMP characters (above ASCII) that EUC-KR can encode; computed once from the JDK charset. */
    private static final BitSet ENCODABLE = encodable();

    private SmsBytes() {
    }

    private static BitSet encodable() {
        CharsetEncoder encoder = Charset.forName("EUC-KR").newEncoder();
        BitSet set = new BitSet(0x10000);
        for (int c = 0x80; c < 0x10000; c++) {
            if (!Character.isSurrogate((char) c) && encoder.canEncode((char) c)) {
                set.set(c);
            }
        }
        return set;
    }

    /** Whether EUC-KR can represent the code point (ASCII always can, supplementary code points never). */
    public static boolean encodable(int codePoint) {
        return codePoint < 0x80 || codePoint < 0x10000 && ENCODABLE.get(codePoint);
    }

    public static int bytes(String s) {
        if (s == null) {
            return 0;
        }
        return s.codePoints().map(cp -> cp < 0x80 ? 1 : 2).sum();
    }

    /** Distinct characters of the text EUC-KR cannot represent, in order of first appearance. */
    public static List<String> unsupported(String s) {
        if (s == null) {
            return List.of();
        }
        Set<String> chars = new LinkedHashSet<>();
        s.codePoints().filter(cp -> !encodable(cp)).forEach(cp -> chars.add(Character.toString(cp)));
        return new ArrayList<>(chars);
    }

    /** Text actually sent: the body plus the enabled notice lines. */
    public static String fullText(String body, boolean customerCenter, boolean optOut, String customerCenterLine,
            String optOutLine) {
        StringBuilder text = new StringBuilder(body == null ? "" : body);
        if (customerCenter) {
            text.append('\n').append(customerCenterLine);
        }
        if (optOut) {
            text.append('\n').append(optOutLine);
        }
        return text.toString();
    }

    public static int smsBytes(String body, boolean customerCenter, boolean optOut, String customerCenterLine,
            String optOutLine) {
        return bytes(fullText(body, customerCenter, optOut, customerCenterLine, optOutLine));
    }
}
