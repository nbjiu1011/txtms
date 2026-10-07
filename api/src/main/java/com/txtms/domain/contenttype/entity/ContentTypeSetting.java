package com.txtms.domain.contenttype.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Whether a content type can be chosen for new requests, and whether its preview mockup is shown. */
@Entity
@Table(name = "content_types")
public class ContentTypeSetting {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ContentType type;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "mock_enabled", nullable = false)
    private boolean mockEnabled;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    protected ContentTypeSetting() {
    }

    public ContentTypeSetting(ContentType type, boolean active, boolean mockEnabled, int sortOrder, Instant now) {
        this.type = type;
        this.active = active;
        this.mockEnabled = mockEnabled;
        this.sortOrder = sortOrder;
        this.updatedAt = now;
    }

    public ContentType getType() {
        return type;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isMockEnabled() {
        return mockEnabled;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }
}
