package com.txtms.domain.request.dto.response;

import java.time.Instant;

public record HistoryEntryResponse(
        long id,
        Instant at,
        Long actorId,
        String action,
        String detail,
        String contentKey,
        String contentTitle,
        int round) {
}
