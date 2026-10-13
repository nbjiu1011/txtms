package com.txtms.domain.request.policy;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;

/** Request facts needed by the request policy. {@code submitted}: the request was ever submitted (kept after a cancel). */
public record RequestFacts(
        String id,
        long projectId,
        RequestStatus status,
        long requesterId,
        List<Long> reviewerIds,
        Long primaryReviewerId,
        boolean recallPending,
        LocalDate dueDate,
        boolean submitted) {

    public RequestFacts {
        reviewerIds = List.copyOf(reviewerIds);
    }

    public static RequestFacts of(Request r) {
        return new RequestFacts(r.getId(), r.getProjectId(), r.getStatus(), r.getRequesterId(), r.getReviewerIds(),
                r.getPrimaryReviewerId(), r.isRecallPending(), r.getDueDate(), r.getSubmittedAt() != null);
    }

    public boolean requester(long userId) {
        return requesterId == userId;
    }

    public boolean reviewer(long userId) {
        return reviewerIds.contains(userId);
    }

    public boolean primary(long userId) {
        return Objects.equals(primaryReviewerId, userId);
    }
}
