package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** RCS card image. Payloads reference it by {@code imageKey}; it is served only within its request. */
@Entity
@Table(name = "content_images")
public class ContentImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_id", nullable = false, updatable = false)
    private Long contentId;

    @Column(name = "image_key", nullable = false, updatable = false, length = 40)
    private String imageKey;

    @Column(name = "storage_key", nullable = false, updatable = false)
    private String storageKey;

    @Column(name = "mime_type", nullable = false, updatable = false, length = 50)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    protected ContentImage() {
    }

    public ContentImage(String requestId, Long contentId, String imageKey, String storageKey, String mimeType,
            long sizeBytes, Instant createdAt, Long createdBy) {
        this.requestId = requestId;
        this.contentId = contentId;
        this.imageKey = imageKey;
        this.storageKey = storageKey;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public String getRequestId() {
        return requestId;
    }

    public Long getContentId() {
        return contentId;
    }

    public String getImageKey() {
        return imageKey;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getMimeType() {
        return mimeType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
