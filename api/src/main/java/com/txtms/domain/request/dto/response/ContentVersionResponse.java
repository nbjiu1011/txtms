package com.txtms.domain.request.dto.response;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonRawValue;

/** One stored content version: payload and FileMeta array as they were at that version. */
public record ContentVersionResponse(
        int version,
        String title,
        @JsonRawValue String payload,
        @JsonRawValue String files,
        Instant createdAt,
        long createdBy) {
}
