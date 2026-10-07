package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Immutable snapshot of a content version (payload + FileMeta array as JSON). */
@Entity
@Table(name = "content_versions")
public class ContentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "content_id", nullable = false, updatable = false)
    private Long contentId;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(nullable = false, updatable = false, length = 200)
    private String title;

    @Column(nullable = false, updatable = false, columnDefinition = "json")
    private String payload;

    @Column(name = "files_snapshot", nullable = false, updatable = false, columnDefinition = "json")
    private String filesSnapshot;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    protected ContentVersion() {
    }

    public ContentVersion(Long contentId, int version, String title, String payload, String filesSnapshot,
            Instant createdAt, Long createdBy) {
        this.contentId = contentId;
        this.version = version;
        this.title = title == null ? "" : title;
        this.payload = payload;
        this.filesSnapshot = filesSnapshot;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public Long getContentId() {
        return contentId;
    }

    public int getVersion() {
        return version;
    }

    public String getTitle() {
        return title;
    }

    public String getPayload() {
        return payload;
    }

    public String getFilesSnapshot() {
        return filesSnapshot;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
