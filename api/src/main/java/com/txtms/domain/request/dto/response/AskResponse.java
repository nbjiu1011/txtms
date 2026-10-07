package com.txtms.domain.request.dto.response;

import java.time.Instant;

public record AskResponse(
        long id,
        long askedBy,
        String contentKey,
        String question,
        Instant askedAt,
        String answer,
        Long answeredBy,
        Instant answeredAt,
        int round) {
}
