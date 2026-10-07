package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Attachment of a content. The id stays the same across revisions; each revision is a {@link ContentFileVersion}. */
@Entity
@Table(name = "content_files")
public class ContentFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "content_id", nullable = false, updatable = false)
    private Long contentId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 10)
    private String ext;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FileUnit unit;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "total_amount")
    private Integer totalAmount;

    @Column(name = "review_amount")
    private Integer reviewAmount;

    @Column(name = "range_note", length = 200)
    private String rangeNote;

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    protected ContentFile() {
    }

    public ContentFile(Long contentId, String name, String ext, FileUnit unit, long sizeBytes, int sortOrder,
            Instant createdAt, Long createdBy) {
        this.contentId = contentId;
        this.name = name;
        this.ext = ext;
        this.unit = unit;
        this.sizeBytes = sizeBytes;
        this.currentVersion = 1;
        this.sortOrder = sortOrder;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public void describeRange(Integer totalAmount, Integer reviewAmount, String rangeNote) {
        this.totalAmount = totalAmount;
        this.reviewAmount = reviewAmount;
        this.rangeNote = rangeNote;
    }

    public void markDeleted() {
        this.deleted = true;
    }

    /** A new revision of the same file (same extension): the id is kept and the version goes up. */
    public void addRevision(String name, long sizeBytes) {
        this.name = name;
        this.sizeBytes = sizeBytes;
        this.currentVersion++;
    }

    public Long getId() {
        return id;
    }

    public Long getContentId() {
        return contentId;
    }

    public String getName() {
        return name;
    }

    public String getExt() {
        return ext;
    }

    public FileUnit getUnit() {
        return unit;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public Integer getTotalAmount() {
        return totalAmount;
    }

    public Integer getReviewAmount() {
        return reviewAmount;
    }

    public String getRangeNote() {
        return rangeNote;
    }

    public int getCurrentVersion() {
        return currentVersion;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
