package com.txtms.domain.request.validation;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.txtms.domain.contenttype.entity.ContentType;

import tools.jackson.databind.JsonNode;

/**
 * Channel specification checks (Alimtalk body/buttons, SMS/LMS bytes, EUC-KR characters). They only ever produce
 * warnings: exceeding a channel limit or using a character EUC-KR cannot represent never blocks saving, submitting,
 * completing or bulk registration. Counting is on the stored text (variable tokens not substituted): characters are
 * Unicode code points, SMS bytes follow {@link SmsBytes} including the enabled notice lines.
 */
public final class ChannelSpecCheck {

    /** Configured channel limits ({@code app.channel-spec}). */
    public record Spec(int bodyMaxChars, int buttonsMax, int buttonNameMaxChars, int smsMaxBytes, int lmsMaxBytes) {
    }

    private final Spec spec;
    private final String customerCenterLine;
    private final String optOutLine;

    public ChannelSpecCheck(Spec spec, String customerCenterLine, String optOutLine) {
        this.spec = spec;
        this.customerCenterLine = customerCenterLine;
        this.optOutLine = optOutLine;
    }

    /** Warning texts for one payload, without the content label. Empty for types without a channel spec. */
    public List<String> warnings(ContentType type, JsonNode payload) {
        List<String> warnings = new ArrayList<>();
        if (type == ContentType.ALIMTALK) {
            int body = chars(str(payload, "body"));
            if (body > spec.bodyMaxChars()) {
                warnings.add(String.format(Locale.ROOT, "본문 %,d자 초과 (%,d자)", spec.bodyMaxChars(), body));
            }
            int buttons = payload.path("buttons").size();
            if (buttons > spec.buttonsMax()) {
                warnings.add(String.format(Locale.ROOT, "버튼 %,d개 초과 (%,d개)", spec.buttonsMax(), buttons));
            }
            for (JsonNode b : payload.path("buttons")) {
                String name = str(b, "name");
                if (chars(name) > spec.buttonNameMaxChars()) {
                    warnings.add(String.format(Locale.ROOT, "버튼명 %,d자 초과 (%s)", spec.buttonNameMaxChars(),
                            name));
                }
            }
        } else if (type == ContentType.SMS) {
            String text = SmsBytes.fullText(str(payload, "body"), payload.path("customerCenter").asBoolean(false),
                    payload.path("optOut").asBoolean(false), customerCenterLine, optOutLine);
            int bytes = SmsBytes.bytes(text);
            if (bytes > spec.lmsMaxBytes()) {
                warnings.add(String.format(Locale.ROOT, "LMS %,d바이트 초과 (%,d바이트)", spec.lmsMaxBytes(), bytes));
            } else if (bytes > spec.smsMaxBytes()) {
                warnings.add(String.format(Locale.ROOT, "SMS %,d바이트 초과 — LMS 예상 전환 (%,d바이트)",
                        spec.smsMaxBytes(), bytes));
            }
            List<String> unsupported = SmsBytes.unsupported(text);
            if (!unsupported.isEmpty()) {
                warnings.add("EUC-KR로 표현할 수 없는 문자: " + String.join(", ", unsupported));
            }
        }
        return warnings;
    }

    /** Character count: Unicode code points, spaces and line breaks included. */
    public static int chars(String s) {
        return s == null ? 0 : s.codePointCount(0, s.length());
    }

    private static String str(JsonNode node, String key) {
        JsonNode v = node.get(key);
        return v == null || v.isNull() ? "" : v.asString("");
    }
}
