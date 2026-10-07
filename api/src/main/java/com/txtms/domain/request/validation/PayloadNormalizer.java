package com.txtms.domain.request.validation;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Strict ContentPayload shape per type (contract §3.4) and the server-protection caps. Drafts in progress are
 * accepted (empty values, missing keys → defaults); unknown keys and wrong value types are rejected. Business limits
 * (1,000 characters, 2,000 bytes, required fields...) are checked at submit by {@link SubmitValidator}.
 * The result always has the same key order so stored payloads compare by text.
 */
public final class PayloadNormalizer {

    /** Server-protection caps. */
    public record Caps(int maxTextLength, int maxButtons, int maxCards) {
    }

    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private static final Map<ContentType, Set<String>> TOP_KEYS = Map.of(
            ContentType.ALIMTALK, Set.of("templateCode", "body", "buttons"),
            ContentType.SMS, Set.of("sender", "body", "customerCenter", "optOut"),
            ContentType.RCS, Set.of("cards"),
            ContentType.FREEFORM, Set.of("title", "text"));
    private static final Set<String> BUTTON_KEYS = Set.of("name", "link");
    private static final Set<String> CARD_KEYS = Set.of("title", "body", "imageKey", "imageAlt", "buttonName",
            "buttonLink");

    private final Caps caps;

    public PayloadNormalizer(Caps caps) {
        this.caps = caps;
    }

    /** The empty payload of a new content of the type. RCS starts with one empty card. */
    public static ObjectNode blank(ContentType type) {
        ObjectNode n = NODES.objectNode();
        switch (type) {
            case ALIMTALK -> {
                n.put("templateCode", "");
                n.put("body", "");
                n.putArray("buttons");
            }
            case SMS -> {
                n.put("sender", "");
                n.put("body", "");
                n.put("customerCenter", false);
                n.put("optOut", false);
            }
            case RCS -> n.putArray("cards").add(blankCard());
            case FREEFORM -> {
                n.put("title", "");
                n.put("text", "");
            }
        }
        return n;
    }

    private static ObjectNode blankCard() {
        ObjectNode card = NODES.objectNode();
        card.put("title", "");
        card.put("body", "");
        card.putNull("imageKey");
        card.put("imageAlt", "");
        card.put("buttonName", "");
        card.put("buttonLink", "");
        return card;
    }

    public ObjectNode normalize(ContentType type, JsonNode raw) {
        if (raw == null || !raw.isObject()) {
            throw shape("payload", "콘텐츠 형식이 올바르지 않습니다");
        }
        rejectUnknown(raw, TOP_KEYS.get(type), "payload");
        ObjectNode n = NODES.objectNode();
        switch (type) {
            case ALIMTALK -> {
                n.put("templateCode", text(raw, "templateCode", "payload"));
                n.put("body", text(raw, "body", "payload"));
                ArrayNode buttons = n.putArray("buttons");
                List<JsonNode> items = array(raw, "buttons", "payload");
                if (items.size() > caps.maxButtons()) {
                    throw limit("payload.buttons", "버튼은 최대 " + caps.maxButtons() + "개입니다");
                }
                for (int i = 0; i < items.size(); i++) {
                    String path = "payload.buttons." + i;
                    JsonNode b = object(items.get(i), path);
                    rejectUnknown(b, BUTTON_KEYS, path);
                    ObjectNode button = buttons.addObject();
                    button.put("name", text(b, "name", path));
                    button.put("link", text(b, "link", path));
                }
            }
            case SMS -> {
                n.put("sender", text(raw, "sender", "payload"));
                n.put("body", text(raw, "body", "payload"));
                n.put("customerCenter", bool(raw, "customerCenter", "payload"));
                n.put("optOut", bool(raw, "optOut", "payload"));
            }
            case RCS -> {
                ArrayNode cards = n.putArray("cards");
                List<JsonNode> items = array(raw, "cards", "payload");
                if (items.size() > caps.maxCards()) {
                    throw limit("payload.cards", "카드는 최대 " + caps.maxCards() + "개입니다");
                }
                for (int i = 0; i < items.size(); i++) {
                    String path = "payload.cards." + i;
                    JsonNode c = object(items.get(i), path);
                    rejectUnknown(c, CARD_KEYS, path);
                    ObjectNode card = cards.addObject();
                    card.put("title", text(c, "title", path));
                    card.put("body", text(c, "body", path));
                    String imageKey = text(c, "imageKey", path);
                    if (imageKey.isEmpty()) {
                        card.putNull("imageKey");
                    } else {
                        card.put("imageKey", imageKey);
                    }
                    card.put("imageAlt", text(c, "imageAlt", path));
                    card.put("buttonName", text(c, "buttonName", path));
                    card.put("buttonLink", text(c, "buttonLink", path));
                }
            }
            case FREEFORM -> {
                n.put("title", text(raw, "title", "payload"));
                n.put("text", text(raw, "text", "payload"));
            }
        }
        return n;
    }

    /** Image keys referenced by RCS cards of a normalized payload. */
    public static List<String> imageKeys(JsonNode payload) {
        List<String> keys = new ArrayList<>();
        for (JsonNode card : payload.path("cards")) {
            JsonNode key = card.get("imageKey");
            if (key != null && key.isString() && !key.asString().isEmpty()) {
                keys.add(key.asString());
            }
        }
        return keys;
    }

    private String text(JsonNode node, String key, String path) {
        JsonNode v = node.get(key);
        if (v == null || v.isNull()) {
            return "";
        }
        if (!v.isString()) {
            throw shape(path + "." + key, "문자열이어야 합니다");
        }
        String s = v.asString();
        if (s.length() > caps.maxTextLength()) {
            throw limit(path + "." + key, String.format("최대 %,d자까지 입력할 수 있습니다", caps.maxTextLength()));
        }
        return s;
    }

    private static boolean bool(JsonNode node, String key, String path) {
        JsonNode v = node.get(key);
        if (v == null || v.isNull()) {
            return false;
        }
        if (!v.isBoolean()) {
            throw shape(path + "." + key, "true 또는 false여야 합니다");
        }
        return v.booleanValue();
    }

    private static List<JsonNode> array(JsonNode node, String key, String path) {
        JsonNode v = node.get(key);
        List<JsonNode> items = new ArrayList<>();
        if (v == null || v.isNull()) {
            return items;
        }
        if (!v.isArray()) {
            throw shape(path + "." + key, "배열이어야 합니다");
        }
        v.forEach(items::add);
        return items;
    }

    private static JsonNode object(JsonNode v, String path) {
        if (v == null || !v.isObject()) {
            throw shape(path, "객체여야 합니다");
        }
        return v;
    }

    private static void rejectUnknown(JsonNode node, Set<String> allowed, String path) {
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            if (!allowed.contains(e.getKey())) {
                throw shape(path + "." + e.getKey(), "알 수 없는 항목입니다");
            }
        }
    }

    private static BusinessException shape(String field, String message) {
        return new BusinessException(ErrorCode.VALIDATION_FAILED, "콘텐츠 형식이 올바르지 않습니다",
                List.of(new ErrorResponse.FieldErrorItem(field, message)), null);
    }

    private static BusinessException limit(String field, String message) {
        return new BusinessException(ErrorCode.LIMIT_EXCEEDED, message,
                List.of(new ErrorResponse.FieldErrorItem(field, message)), null);
    }
}
