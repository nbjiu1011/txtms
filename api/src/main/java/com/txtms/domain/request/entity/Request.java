package com.txtms.domain.request.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** A review request (business id like {@code REQ-2610-121}). Contents are separate rows keyed by request id. */
@Entity
@Table(name = "requests")
public class Request {

    @Id
    @Column(length = 20)
    private String id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 20)
    private ContentType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status;

    @Column(nullable = false)
    private int round;

    @Column(name = "round_bump", nullable = false)
    private boolean roundBump;

    @Column(name = "answer_changed", nullable = false)
    private boolean answerChanged;

    @Column(name = "hope_due_date")
    private LocalDate hopeDueDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Urgency urgency;

    @Column(columnDefinition = "text")
    private String purpose;

    @Column(columnDefinition = "text")
    private String target;

    @Column(columnDefinition = "text")
    private String background;

    @Column(length = 200)
    private String campaign;

    @Column(name = "requested_by", nullable = false, updatable = false)
    private Long requesterId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "primary_reviewer_id")
    private Long primaryReviewerId;

    @ElementCollection
    @CollectionTable(name = "request_reviewers", joinColumns = @JoinColumn(name = "request_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "user_id")
    private List<Long> reviewerIds = new ArrayList<>();

    @Column(name = "recall_requested_by")
    private Long recallRequestedBy;

    @Column(name = "recall_requested_at")
    private Instant recallRequestedAt;

    @Column(name = "recall_reason", columnDefinition = "text")
    private String recallReason;

    @Column(nullable = false)
    private boolean cancelled;

    @Column(nullable = false)
    private boolean demo;

    @Column(name = "parent_request_id", length = 20)
    private String parentRequestId;

    @Column(name = "parent_content_key", length = 10)
    private String parentContentKey;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "submit_idempotency_key", length = 64)
    private String submitIdempotencyKey;

    protected Request() {
    }

    public Request(String id, Long projectId, ContentType type, Long requesterId, Instant now) {
        this.id = id;
        this.projectId = projectId;
        this.type = type;
        this.title = "";
        this.status = RequestStatus.DRAFT;
        this.round = 1;
        this.urgency = Urgency.NORMAL;
        this.requesterId = requesterId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    /** Moves to {@code next} only along the defined state machine. */
    public void transitionTo(RequestStatus next, Instant now) {
        if (!status.canTransitionTo(next)) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
        this.status = next;
        this.updatedAt = now;
    }

    /**
     * Applies the editable request information (draft only). A new hope due date also replaces the due date, which
     * the lead reviewer confirms at assignment. Returns whether anything changed.
     */
    public boolean updateInfo(RequestInfo info, Instant now) {
        requireStatus(RequestStatus.DRAFT);
        RequestInfo before = info();
        if (before.equals(info)) {
            return false;
        }
        this.title = info.title() == null ? "" : info.title();
        this.purpose = info.purpose();
        this.target = info.target();
        this.background = info.background();
        this.campaign = info.campaign();
        this.urgency = info.urgency() == null ? Urgency.NORMAL : info.urgency();
        if (!java.util.Objects.equals(before.hopeDueDate(), info.hopeDueDate())) {
            this.hopeDueDate = info.hopeDueDate();
            this.dueDate = info.hopeDueDate();
        }
        this.updatedAt = now;
        return true;
    }

    public RequestInfo info() {
        return new RequestInfo(title, hopeDueDate, purpose, target, background, campaign, urgency);
    }

    /** Changes the content type of a draft (contents are reset by the caller). */
    public void changeType(ContentType type, Instant now) {
        requireStatus(RequestStatus.DRAFT);
        this.type = type;
        this.updatedAt = now;
    }

    /**
     * Submit: DRAFT → WAITING. After an approved recall ({@code roundBump}) the round goes up by one; otherwise the
     * round is kept (first submit and resubmit after a cancel). The first submission time is kept, an empty due date
     * takes the hope due date.
     */
    public void submit(Instant now, String idempotencyKey) {
        transitionTo(RequestStatus.WAITING, now);
        if (roundBump) {
            this.round++;
            this.roundBump = false;
        }
        this.cancelled = false;
        if (this.submittedAt == null) {
            this.submittedAt = now;
        }
        if (this.dueDate == null) {
            this.dueDate = this.hopeDueDate;
        }
        this.submitIdempotencyKey = idempotencyKey;
    }

    /** Cancel before assignment: WAITING → DRAFT, round kept, no round bump on the next submit. */
    public void cancel(Instant now) {
        transitionTo(RequestStatus.DRAFT, now);
        this.cancelled = true;
        this.roundBump = false;
        this.submitIdempotencyKey = null;
    }

    /**
     * Recall approved by the primary reviewer: back to draft, assignment cleared, next submit opens a new round.
     * (Used from the review milestone; kept here so the round rule has one home.)
     */
    public void approveRecall(Instant now) {
        transitionTo(RequestStatus.DRAFT, now);
        this.reviewerIds = new ArrayList<>();
        this.primaryReviewerId = null;
        this.recallRequestedBy = null;
        this.recallRequestedAt = null;
        this.recallReason = null;
        this.roundBump = true;
    }

    private void requireStatus(RequestStatus expected) {
        if (status != expected) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
    }

    public void describe(String title, String purpose, String target, String background, String campaign) {
        this.title = title == null ? "" : title;
        this.purpose = purpose;
        this.target = target;
        this.background = background;
        this.campaign = campaign;
    }

    public void schedule(LocalDate hopeDueDate, LocalDate dueDate, Urgency urgency) {
        this.hopeDueDate = hopeDueDate;
        this.dueDate = dueDate;
        this.urgency = urgency;
    }

    /**
     * Seeding only: places the request at a point of its lifecycle reached through the normal workflow
     * (status, round, timestamps and assignment) without replaying each transition.
     */
    public void restoreSeedState(RequestStatus status, int round, Instant submittedAt, Instant completedAt,
            List<Long> reviewerIds, Long primaryReviewerId) {
        this.status = status;
        this.round = round;
        this.submittedAt = submittedAt;
        this.completedAt = completedAt;
        this.reviewerIds = new ArrayList<>(reviewerIds);
        this.primaryReviewerId = primaryReviewerId;
    }

    public void markRecallRequested(Long userId, Instant at, String reason) {
        this.recallRequestedBy = userId;
        this.recallRequestedAt = at;
        this.recallReason = reason;
    }

    public void linkParent(String parentRequestId, String parentContentKey) {
        this.parentRequestId = parentRequestId;
        this.parentContentKey = parentContentKey;
    }

    public boolean isRecallPending() {
        return recallRequestedBy != null;
    }

    public String getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public ContentType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public RequestStatus getStatus() {
        return status;
    }

    public int getRound() {
        return round;
    }

    public boolean isRoundBump() {
        return roundBump;
    }

    public boolean isAnswerChanged() {
        return answerChanged;
    }

    public LocalDate getHopeDueDate() {
        return hopeDueDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public Urgency getUrgency() {
        return urgency;
    }

    public String getPurpose() {
        return purpose;
    }

    public String getTarget() {
        return target;
    }

    public String getBackground() {
        return background;
    }

    public String getCampaign() {
        return campaign;
    }

    public Long getRequesterId() {
        return requesterId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Long getPrimaryReviewerId() {
        return primaryReviewerId;
    }

    public List<Long> getReviewerIds() {
        return List.copyOf(reviewerIds);
    }

    public Long getRecallRequestedBy() {
        return recallRequestedBy;
    }

    public Instant getRecallRequestedAt() {
        return recallRequestedAt;
    }

    public String getRecallReason() {
        return recallReason;
    }

    public boolean isCancelled() {
        return cancelled;
    }

    public boolean isDemo() {
        return demo;
    }

    public String getParentRequestId() {
        return parentRequestId;
    }

    public String getParentContentKey() {
        return parentContentKey;
    }

    public long getRowVersion() {
        return rowVersion;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getSubmitIdempotencyKey() {
        return submitIdempotencyKey;
    }
}
