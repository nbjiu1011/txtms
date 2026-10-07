package com.txtms.domain.request.dto.request;

import java.util.List;

import tools.jackson.databind.JsonNode;

/**
 * Saved revision of a submitted request's content. {@code title} may be omitted (titles change only while
 * drafting); {@code files} optionally carries attachment amounts edited in the same buffer.
 */
public record RevisionBody(Integer baseVersion, String title, JsonNode payload, List<FileRange> files) {

    public record FileRange(Long fileId, Integer totalAmount, Integer reviewAmount, String rangeNote) {
    }
}
