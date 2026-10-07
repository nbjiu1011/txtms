package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

/** Contract AssignmentChange (§3.7): one reviewer/primary change with its reason and handover. */
public record AssignmentChangeResponse(
        Instant at,
        long actorId,
        int round,
        List<Long> fromReviewerIds,
        Long fromPrimaryId,
        List<Long> toReviewerIds,
        Long toPrimaryId,
        String reason,
        String handover) {
}
