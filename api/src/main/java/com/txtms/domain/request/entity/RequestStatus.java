package com.txtms.domain.request.entity;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Request state machine. Every status change goes through {@link #canTransitionTo}.
 *
 * <pre>
 * DRAFT → WAITING                      submit
 * WAITING → DRAFT                      cancel before assignment
 * WAITING → IN_REVIEW                  assignment by the lead reviewer
 * IN_REVIEW → CONFIRMING               reviewer asks the requester
 * CONFIRMING → IN_REVIEW               requester answers
 * IN_REVIEW → DRAFT                    recall approved by the primary reviewer
 * IN_REVIEW → REVIEW_COMPLETED         primary completes (approval not used, final)
 * IN_REVIEW → APPROVAL_WAITING         primary completes (approval used)
 * APPROVAL_WAITING → APPROVED          eligible approver approves (final)
 * APPROVAL_WAITING → IN_REVIEW         eligible approver requests a revision
 * </pre>
 */
public enum RequestStatus {
    DRAFT,
    WAITING,
    IN_REVIEW,
    CONFIRMING,
    APPROVAL_WAITING,
    REVIEW_COMPLETED,
    APPROVED;

    private static final Map<RequestStatus, Set<RequestStatus>> TRANSITIONS = Map.of(
            DRAFT, EnumSet.of(WAITING),
            WAITING, EnumSet.of(DRAFT, IN_REVIEW),
            IN_REVIEW, EnumSet.of(CONFIRMING, DRAFT, REVIEW_COMPLETED, APPROVAL_WAITING),
            CONFIRMING, EnumSet.of(IN_REVIEW),
            APPROVAL_WAITING, EnumSet.of(APPROVED, IN_REVIEW),
            REVIEW_COMPLETED, EnumSet.noneOf(RequestStatus.class),
            APPROVED, EnumSet.noneOf(RequestStatus.class));

    public boolean canTransitionTo(RequestStatus next) {
        return TRANSITIONS.get(this).contains(next);
    }

    /** Final completion: review completed (approval not used) or approved. */
    public boolean isFinal() {
        return this == REVIEW_COMPLETED || this == APPROVED;
    }
}
