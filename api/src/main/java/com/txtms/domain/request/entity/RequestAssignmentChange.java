package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Structured record of a reviewer/primary change during review: the assignment before and after, the reason and
 * the handover note. Append-only (earlier opinions and history stay untouched).
 */
@Entity
@Table(name = "request_assignment_changes")
public class RequestAssignmentChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(nullable = false, updatable = false)
    private Instant at;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false)
    private int round;

    /** JSON array of user ids. */
    @Column(name = "from_reviewer_ids", nullable = false, updatable = false, columnDefinition = "json")
    private String fromReviewerIds;

    @Column(name = "from_primary_id", updatable = false)
    private Long fromPrimaryId;

    /** JSON array of user ids. */
    @Column(name = "to_reviewer_ids", nullable = false, updatable = false, columnDefinition = "json")
    private String toReviewerIds;

    @Column(name = "to_primary_id", updatable = false)
    private Long toPrimaryId;

    @Column(updatable = false, columnDefinition = "text")
    private String reason;

    @Column(updatable = false, columnDefinition = "text")
    private String handover;

    protected RequestAssignmentChange() {
    }

    public RequestAssignmentChange(String requestId, Instant at, Long actorId, int round, String fromReviewerIds,
            Long fromPrimaryId, String toReviewerIds, Long toPrimaryId, String reason, String handover) {
        this.requestId = requestId;
        this.at = at;
        this.actorId = actorId;
        this.round = round;
        this.fromReviewerIds = fromReviewerIds;
        this.fromPrimaryId = fromPrimaryId;
        this.toReviewerIds = toReviewerIds;
        this.toPrimaryId = toPrimaryId;
        this.reason = reason;
        this.handover = handover;
    }

    public Long getId() {
        return id;
    }

    public String getRequestId() {
        return requestId;
    }

    public Instant getAt() {
        return at;
    }

    public Long getActorId() {
        return actorId;
    }

    public int getRound() {
        return round;
    }

    public String getFromReviewerIds() {
        return fromReviewerIds;
    }

    public Long getFromPrimaryId() {
        return fromPrimaryId;
    }

    public String getToReviewerIds() {
        return toReviewerIds;
    }

    public Long getToPrimaryId() {
        return toPrimaryId;
    }

    public String getReason() {
        return reason;
    }

    public String getHandover() {
        return handover;
    }
}
