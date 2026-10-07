package com.txtms.domain.request.dto.request;

import java.util.List;

/** Reviewer or primary change during review: reason and handover are required. */
public record AssignmentChangeBody(List<Long> reviewerIds, Long primaryReviewerId, String reason, String handover,
        Long rowVersion) {
}
