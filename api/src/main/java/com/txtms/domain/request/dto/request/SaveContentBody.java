package com.txtms.domain.request.dto.request;

import java.time.Instant;

import tools.jackson.databind.JsonNode;

/** Draft autosave. {@code expectedSavedAt} is the {@code savedAt} the client last loaded. */
public record SaveContentBody(String title, JsonNode payload, Instant expectedSavedAt) {
}
