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

    /** {@code POST …/lock} response: the lock plus the content's current version (§14.2). */
    public record LockGrant(long userId, Instant lockedAt, Instant expiresAt, int version) {
    }

    /**
     * {@code GET /api/requests/{id}/locks} row: every current content with its version; {@code userId},
     * {@code lockedAt}, {@code expiresAt} are null when there is no valid lock (§14.2).
     */
    public record LockState(String contentKey, Long userId, Instant lockedAt, Instant expiresAt, int version) {
    }

    public record VersionRef(int version, Instant createdAt, long createdBy) {
    }
}
