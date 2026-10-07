package com.txtms.domain.request.dto.response;

import java.time.Instant;

public record OpinionResponse(long id, long authorId, String contentKey, String body, int round, Instant createdAt) {
}
