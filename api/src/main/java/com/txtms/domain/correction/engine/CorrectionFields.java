package com.txtms.domain.correction.engine;

import java.util.ArrayList;
import java.util.List;

import com.txtms.domain.contenttype.entity.ContentType;

import tools.jackson.databind.JsonNode;

/**
 * Text fields of a ContentPayload that text correction checks, in display order, keyed by their payload path
 * (contract §3.4): alimtalk {@code body}, {@code buttons.{i}.name} (links are not checked); SMS {@code body};
 * RCS {@code cards.{i}.title}, {@code cards.{i}.body}; free-form {@code title}, {@code text}. Only the text entered
 * in TMS is checked: a free-form content's attachments are never read, and having them does not exclude the
 * content (client decision 2026-10-12).
 */
public final class CorrectionFields {

    /** One checked text and its key. */
    public record Field(String key, String text) {
    }

    private CorrectionFields() {
    }

    public static List<Field> of(ContentType type, JsonNode payload) {
        List<Field> out = new ArrayList<>();
        switch (type) {
            case ALIMTALK -> {
                out.add(new Field("body", str(payload, "body")));
                int i = 0;
                for (JsonNode b : payload.path("buttons")) {
                    out.add(new Field("buttons." + i++ + ".name", str(b, "name")));
                }
            }
            case SMS -> out.add(new Field("body", str(payload, "body")));
            case RCS -> {
                int i = 0;
                for (JsonNode c : payload.path("cards")) {
                    out.add(new Field("cards." + i + ".title", str(c, "title")));
                    out.add(new Field("cards." + i + ".body", str(c, "body")));
                    i++;
                }
            }
            case FREEFORM -> {
                out.add(new Field("title", str(payload, "title")));
                out.add(new Field("text", str(payload, "text")));
            }
        }
        return out;
    }

    /**
     * Whether {@code key} has the shape of a checked field of the type (correction events come from the editing
     * buffer, which may have more buttons or cards than the saved payload).
     */
    public static boolean validKey(ContentType type, String key) {
        if (key == null) {
            return false;
        }
        return switch (type) {
            case ALIMTALK -> key.equals("body") || key.matches("buttons\\.\\d{1,2}\\.name");
            case SMS -> key.equals("body");
            case RCS -> key.matches("cards\\.\\d{1,2}\\.(title|body)");
            case FREEFORM -> key.equals("title") || key.equals("text");
        };
    }

    private static String str(JsonNode node, String key) {
        JsonNode v = node.get(key);
        return v != null && v.isString() ? v.asString() : "";
    }
}
