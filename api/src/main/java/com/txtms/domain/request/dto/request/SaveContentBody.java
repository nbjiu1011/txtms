package com.txtms.domain.request.dto.request;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

import tools.jackson.databind.JsonNode;

/**
 * Draft autosave {@code { title?, payload, expectedSavedAt? }}. {@code expectedSavedAt} is the {@code savedAt} the
 * client last loaded, and its presence matters (contract §4): the key left out means "do not check",
 * {@code null} means "I expect the content was never saved", a value means "nothing newer was saved". The setter
 * records the presence because a record cannot tell an absent key from an explicit null.
 */
public final class SaveContentBody {

    private String title;
    private JsonNode payload;
    private Instant expectedSavedAt;
    private boolean expectedSavedAtPresent;

    public SaveContentBody() {
    }

    /** A body without {@code expectedSavedAt} (no conflict check). */
    public SaveContentBody(String title, JsonNode payload) {
        this.title = title;
        this.payload = payload;
    }

    @JsonProperty("title")
    public void setTitle(String title) {
        this.title = title;
    }

    @JsonProperty("payload")
    public void setPayload(JsonNode payload) {
        this.payload = payload;
    }

    @JsonProperty("expectedSavedAt")
    public void setExpectedSavedAt(Instant expectedSavedAt) {
        this.expectedSavedAt = expectedSavedAt;
        this.expectedSavedAtPresent = true;
    }

    public String title() {
        return title;
    }

    public JsonNode payload() {
        return payload;
    }

    public Instant expectedSavedAt() {
        return expectedSavedAt;
    }

    /** Whether the body had the {@code expectedSavedAt} key (null or a value). */
    public boolean expectedSavedAtPresent() {
        return expectedSavedAtPresent;
    }
}
