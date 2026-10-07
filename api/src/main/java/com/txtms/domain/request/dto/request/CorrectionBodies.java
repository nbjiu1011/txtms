package com.txtms.domain.request.dto.request;

import java.util.List;

import tools.jackson.databind.JsonNode;

/** Request bodies of the text correction endpoints (contract §6). */
public final class CorrectionBodies {

    private CorrectionBodies() {
    }

    /** {@code { contents: [{ contentKey, payload, hasFiles }] }} — the editing buffer of each content to check. */
    public record CheckBody(List<CheckItem> contents) {
    }

    public record CheckItem(String contentKey, JsonNode payload, Boolean hasFiles) {
    }

    /** {@code { contentKey, action: "APPLY"|"RESTORE", field, before, after }}. */
    public record EventBody(String contentKey, String action, String field, String before, String after) {
    }

    /** {@code { contentKey, matchedText, ruleIds, body }}. */
    public record SuggestionBody(String contentKey, String matchedText, List<String> ruleIds, String body) {
    }
}
