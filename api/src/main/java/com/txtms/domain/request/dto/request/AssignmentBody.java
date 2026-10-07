package com.txtms.domain.request.dto.request;

import java.time.LocalDate;
import java.util.List;

import com.txtms.domain.request.entity.Urgency;

/**
 * First assignment. {@code primaryReviewerId} may be omitted when one reviewer is chosen; {@code urgency} null keeps
 * the current value.
 */
public record AssignmentBody(List<Long> reviewerIds, Long primaryReviewerId, LocalDate dueDate, Urgency urgency,
        Long rowVersion) {
}
