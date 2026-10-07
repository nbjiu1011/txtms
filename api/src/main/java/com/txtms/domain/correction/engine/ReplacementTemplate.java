package com.txtms.domain.correction.engine;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.MatchResult;

/**
 * Replacement of a pattern rule ({@code recommended_pattern}). Group references are written {@code $N} (sample
 * dataset) or {@code \N} (engine specification); both are accepted and {@link #normalize} stores them as
 * {@code $N}. Digits after the marker are read like Java's {@code Matcher.appendReplacement}: the first digit is the
 * group, further digits are taken while the number stays a valid group. Every other character (a {@code $} or
 * {@code \} not followed by a digit included) is literal, so recommended text never fails at run time. A group that
 * did not take part in the match expands to the empty string.
 */
public final class ReplacementTemplate {

    private sealed interface Part permits Literal, GroupRef {
    }

    private record Literal(String text) implements Part {
    }

    private record GroupRef(int group) implements Part {
    }

    private final List<Part> parts;

    private ReplacementTemplate(List<Part> parts) {
        this.parts = parts;
    }

    /** {@code \N} → {@code $N} (only a backslash directly followed by a digit is a group reference). */
    public static String normalize(String template) {
        if (template == null || template.indexOf('\\') < 0) {
            return template;
        }
        StringBuilder out = new StringBuilder(template.length());
        for (int i = 0; i < template.length(); i++) {
            char c = template.charAt(i);
            if (c == '\\' && i + 1 < template.length() && isDigit(template.charAt(i + 1))) {
                out.append('$');
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    /**
     * @param groupCount capturing groups of the original pattern
     * @throws IllegalArgumentException when the template refers to a group the pattern does not have
     */
    public static ReplacementTemplate parse(String template, int groupCount) {
        List<Part> parts = new ArrayList<>();
        StringBuilder literal = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            char c = template.charAt(i);
            if ((c == '$' || c == '\\') && i + 1 < template.length() && isDigit(template.charAt(i + 1))) {
                int group = template.charAt(i + 1) - '0';
                if (group > groupCount) {
                    throw new IllegalArgumentException("없는 그룹 $" + group + "을(를) 참조합니다");
                }
                i += 2;
                while (i < template.length() && isDigit(template.charAt(i))) {
                    int next = group * 10 + (template.charAt(i) - '0');
                    if (next > groupCount) {
                        break;
                    }
                    group = next;
                    i++;
                }
                if (!literal.isEmpty()) {
                    parts.add(new Literal(literal.toString()));
                    literal.setLength(0);
                }
                parts.add(new GroupRef(group));
            } else {
                literal.append(c);
                i++;
            }
        }
        if (!literal.isEmpty()) {
            parts.add(new Literal(literal.toString()));
        }
        return new ReplacementTemplate(List.copyOf(parts));
    }

    public String expand(MatchResult match) {
        StringBuilder out = new StringBuilder();
        for (Part part : parts) {
            switch (part) {
                case Literal l -> out.append(l.text());
                case GroupRef g -> {
                    String value = match.group(g.group());
                    if (value != null) {
                        out.append(value);
                    }
                }
            }
        }
        return out.toString();
    }

    private static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }
}
