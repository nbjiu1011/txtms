package com.txtms.domain.request.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.variable.dto.VariableSnapshot;
import com.txtms.global.common.Kst;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Completion bundle rules (pure): which contents and values are frozen, and how frozen values are read back.
 * The bundle holds every current content (title, current version, payload and the FileMeta array of its current
 * attachments) in content order, and the active variables of the project at that moment.
 */
public final class CompletionBundles {

    /** A current content at completion; {@code filesJson} is the FileMeta array of its current attachments. */
    public record ContentState(String key, String title, int version, String payload, String filesJson,
            int sortOrder) {
    }

    /** A bundle item to store ({@code sortOrder} renumbered from 1 in content order). */
    public record Item(String contentKey, String title, int version, String payload, String filesJson,
            int sortOrder) {
    }

    private CompletionBundles() {
    }

    public static List<Item> items(List<ContentState> contents) {
        List<ContentState> ordered = new ArrayList<>(contents);
        ordered.sort(Comparator.comparingInt(ContentState::sortOrder));
        List<Item> items = new ArrayList<>();
        int n = 0;
        for (ContentState c : ordered) {
            items.add(new Item(c.key(), c.title() == null ? "" : c.title(), c.version(), c.payload(),
                    c.filesJson() == null ? "[]" : c.filesJson(), ++n));
        }
        return items;
    }

    /** {@code [{key, type, value}]} in the given (registration) order. */
    public static String variablesJson(List<VariableSnapshot> variables, JsonMapper json) {
        return json.writeValueAsString(variables);
    }

    /** Frozen values of a bundle: key → value (missing values as empty strings). */
    public static Map<String, String> values(String variablesJson, JsonMapper json) {
        Map<String, String> values = new LinkedHashMap<>();
        if (variablesJson == null || variablesJson.isBlank()) {
            return values;
        }
        for (JsonNode v : json.readTree(variablesJson)) {
            JsonNode key = v.get("key");
            if (key != null && key.isString()) {
                JsonNode value = v.get("value");
                values.put(key.asString(), value == null || value.isNull() ? "" : value.asString());
            }
        }
        return values;
    }

    /** Status label of exports: {@code 검수 완료} / {@code 승인 완료}. */
    public static String statusLabel(RequestStatus status) {
        return switch (status) {
            case REVIEW_COMPLETED -> "검수 완료";
            case APPROVED -> "승인 완료";
            default -> throw new IllegalArgumentException("not a final status: " + status);
        };
    }

    /** Completion date of exports: {@code YYYY-MM-DD (KST)}. */
    public static String completedDate(Instant completedAt) {
        return Kst.dateOf(completedAt) + " (KST)";
    }
}
