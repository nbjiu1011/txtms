package com.txtms.domain.request.validation;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Variable tokens {@code #{key}} inside content text. */
public final class VariableTokens {

    public static final Pattern TOKEN = Pattern.compile("#\\{([^}]+)\\}");

    private VariableTokens() {
    }

    /** Keys in order of appearance, without duplicates. */
    public static Set<String> keys(String text) {
        Set<String> keys = new LinkedHashSet<>();
        if (text == null) {
            return keys;
        }
        Matcher m = TOKEN.matcher(text);
        while (m.find()) {
            keys.add(m.group(1));
        }
        return keys;
    }

    public static boolean contains(String text, String key) {
        return text != null && text.contains("#{" + key + "}");
    }

    /** Replaces known tokens with their values; unknown tokens stay as they are. */
    public static String resolve(String text, Map<String, String> values) {
        Matcher m = TOKEN.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String value = values.get(m.group(1));
            m.appendReplacement(out, Matcher.quoteReplacement(value != null ? value : m.group()));
        }
        m.appendTail(out);
        return out.toString();
    }
}
