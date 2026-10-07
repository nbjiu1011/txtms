package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Contents, versions and variable values frozen at final completion. */
@Entity
@Table(name = "completion_bundles")
public class CompletionBundle {

    @Id
    @Column(name = "request_id", length = 20)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private RequestStatus status;

    @Column(name = "completed_at", nullable = false, updatable = false)
    private Instant completedAt;

    @Column(name = "completed_by", nullable = false, updatable = false)
    private Long completedBy;

    /** JSON array of {@code {key, type, value}}. */
    @Column(name = "variables_snapshot", nullable = false, updatable = false, columnDefinition = "json")
    private String variablesSnapshot;

    protected CompletionBundle() {
    }

    public CompletionBundle(String requestId, RequestStatus status, Instant completedAt, Long completedBy,
            String variablesSnapshot) {
        if (!status.isFinal()) {
            throw new IllegalArgumentException("bundle status must be final");
        }
        this.requestId = requestId;
        this.status = status;
        this.completedAt = completedAt;
        this.completedBy = completedBy;
        this.variablesSnapshot = variablesSnapshot;
    }

    public String getRequestId() {
        return requestId;
    }

    public RequestStatus getStatus() {
        return status;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Long getCompletedBy() {
        return completedBy;
    }

    public String getVariablesSnapshot() {
        return variablesSnapshot;
    }
}
