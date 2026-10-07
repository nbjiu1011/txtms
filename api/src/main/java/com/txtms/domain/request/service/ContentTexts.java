package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.validation.VariableTokens;

import tools.jackson.databind.JsonNode;

/**
 * Text views of a ContentPayload (pure): the text fields of the correction and archive search, the body of exports,
 * button names and links, the variables a content uses, and variable substitution.
 */
public final class ContentTexts {

    private ContentTexts() {
    }

    /**
     * Text fields checked by text correction and searched in the archive, in display order: alimtalk body and
     * button names (not links), SMS body, RCS card titles and bodies, free-form title and text.
     */
    public static List<String> textFields(ContentType type, JsonNode payload) {
        List<String> out = new ArrayList<>();
        switch (type) {
            case ALIMTALK -> {
                out.add(str(payload, "body"));
                payload.path("buttons").forEach(b -> out.add(str(b, "name")));
            }
            case SMS -> out.add(str(payload, "body"));
            case RCS -> payload.path("cards").forEach(c -> {
                out.add(str(c, "title"));
                out.add(str(c, "body"));
            });
            case FREEFORM -> {
                out.add(str(payload, "title"));
                out.add(str(payload, "text"));
            }
        }
        return out;
    }

    /** Body of exports and archive previews: body, RCS card bodies joined by line breaks, free-form text. */
    public static String body(ContentType type, JsonNode payload) {
        return switch (type) {
            case ALIMTALK, SMS -> str(payload, "body");
            case RCS -> String.join("\n", collect(payload.path("cards"), "body"));
            case FREEFORM -> str(payload, "text");
        };
    }

    /** Button names (alimtalk buttons, one line per RCS card) joined by line breaks; empty when there are none. */
    public static String buttonNames(ContentType type, JsonNode payload) {
        return switch (type) {
            case ALIMTALK -> joinLines(collect(payload.path("buttons"), "name"));
            case RCS -> joinLines(collect(payload.path("cards"), "buttonName"));
            default -> "";
        };
    }

    /** Button links, aligned with {@link #buttonNames}. */
    public static String buttonLinks(ContentType type, JsonNode payload) {
        return switch (type) {
            case ALIMTALK -> joinLines(collect(payload.path("buttons"), "link"));
            case RCS -> joinLines(collect(payload.path("cards"), "buttonLink"));
            default -> "";
        };
    }

    /** Variable keys used anywhere in the payload's strings, in order of first appearance. */
    public static Set<String> variableKeys(JsonNode payload) {
        Set<String> keys = new LinkedHashSet<>();
        collectKeys(payload, keys);
        return keys;
    }

    /** Replaces {@code #{key}} with the given values; unknown keys stay as tokens. */
    public static String resolve(String text, Map<String, String> values) {
        return text == null ? "" : VariableTokens.resolve(text, values);
    }

    private static void collectKeys(JsonNode node, Set<String> keys) {
        if (node == null) {
            return;
        }
        if (node.isString()) {
            keys.addAll(VariableTokens.keys(node.asString()));
        } else if (node.isArray()) {
            node.forEach(n -> collectKeys(n, keys));
        } else if (node.isObject()) {
            node.properties().forEach(e -> {
                if (!"imageKey".equals(e.getKey())) {
                    collectKeys(e.getValue(), keys);
                }
            });
        }
    }

    private static List<String> collect(JsonNode array, String field) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(str(n, field)));
        return out;
    }

    /** Lines joined by line breaks; all blank → empty string. */
    private static String joinLines(List<String> lines) {
        return lines.stream().allMatch(String::isBlank) ? "" : String.join("\n", lines);
    }

    private static String str(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        return v == null || !v.isString() ? "" : v.asString();
    }
}
