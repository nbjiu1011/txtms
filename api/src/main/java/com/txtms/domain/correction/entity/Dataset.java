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

/** One immutable version of a correction dataset. A change is always a new version of the same scope. */
@Entity
@Table(name = "datasets")
public class Dataset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private DatasetScope scope;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    protected Dataset() {
    }

    public Dataset(DatasetScope scope, int version, Instant createdAt, Long createdBy) {
        this.scope = scope;
        this.version = version;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public String label() {
        return scope.label(version);
    }

    public Long getId() {
        return id;
    }

    public DatasetScope getScope() {
        return scope;
    }

    public int getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
