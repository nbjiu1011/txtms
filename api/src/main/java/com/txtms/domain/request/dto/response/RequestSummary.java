package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.entity.Urgency;

/**
 * Contract RequestSummary (§3.1). {@code approvable}: the requesting user is an eligible approver of this request and
 * it waits for approval (§14.2).
 */
public record RequestSummary(
        String id,
        long projectId,
        ContentType type,
        String title,
        RequestStatus status,
        int round,
        long requesterId,
        List<Long> reviewerIds,
        Long primaryReviewerId,
        Long leadUserId,
        LocalDate hopeDueDate,
        LocalDate dueDate,
        Urgency urgency,
        Instant submittedAt,
        Instant createdAt,
        Instant completedAt,
        boolean recallRequested,
        String parentRequestId,
        String campaign,
        boolean dueSoon,
        boolean overdue,
        int contentCount,
        List<Integer> contentVersions,
        List<ContentRef> contents,
        Volume volume,
        boolean approvable) {

    /** Current (not deleted) content in sort order. */
    public record ContentRef(String key, String title) {
    }
}
