package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonRawValue;

/** Contract Content (§3.3). {@code payload} is the stored ContentPayload JSON. */
public record ContentResponse(
        String key,
        String title,
        int version,
        @JsonRawValue String payload,
        List<FileMeta> files,
        Lock lock,
        Instant savedAt,
        List<VersionRef> versions) {

    public record Lock(long userId, Instant lockedAt, Instant expiresAt) {
    }

    public record VersionRef(int version, Instant createdAt, long createdBy) {
    }
}
