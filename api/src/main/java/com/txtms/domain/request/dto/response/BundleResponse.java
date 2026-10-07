package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonRawValue;
import com.txtms.domain.request.entity.RequestStatus;

/** Contract CompletionBundle (§3.6). Variables and item payloads/files are frozen JSON snapshots. */
public record BundleResponse(
        RequestStatus status,
        Instant completedAt,
        long completedBy,
        @JsonRawValue String variables,
        List<Item> items) {

    public record Item(
            String contentKey,
            String title,
            int version,
            @JsonRawValue String payload,
            @JsonRawValue String files) {
    }
}
