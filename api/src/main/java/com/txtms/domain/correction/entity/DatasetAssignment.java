package com.txtms.domain.correction.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The effective dataset of one customer × content type ({@code type} is a {@link DatasetScope}; {@code COMMON}
 * rows only exist in data seeded before Phase 1 dropped the combination). Changing the dataset clears the
 * operator's confirmation ({@code checkedAt/By}); checks already run keep their results, the next check uses the
 * new dataset.
 */
@Entity
@Table(name = "dataset_assignments")
public class DatasetAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private Long customerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private DatasetScope type;

    @Column(name = "dataset_id", nullable = false)
    private Long datasetId;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @Column(name = "checked_at")
    private Instant checkedAt;

    @Column(name = "checked_by")
    private Long checkedBy;

    protected DatasetAssignment() {
    }

    public DatasetAssignment(Long customerId, DatasetScope type, Long datasetId, Instant assignedAt, Long assignedBy) {
        this.customerId = customerId;
        this.type = type;
        this.datasetId = datasetId;
        this.assignedAt = assignedAt;
        this.assignedBy = assignedBy;
    }

    /** Points the assignment at another dataset version; the confirmation must be given again. */
    public void change(Long datasetId, Instant now, Long by) {
        this.datasetId = datasetId;
        this.assignedAt = now;
        this.assignedBy = by;
        this.checkedAt = null;
        this.checkedBy = null;
    }

    /** The operator confirmed the assignment (again). */
    public void confirm(Instant now, Long by) {
        this.checkedAt = now;
        this.checkedBy = by;
    }

    public Long getId() {
        return id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public DatasetScope getType() {
        return type;
    }

    public Long getDatasetId() {
        return datasetId;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public Long getAssignedBy() {
        return assignedBy;
    }

    public Instant getCheckedAt() {
        return checkedAt;
    }

    public Long getCheckedBy() {
        return checkedBy;
    }
}
