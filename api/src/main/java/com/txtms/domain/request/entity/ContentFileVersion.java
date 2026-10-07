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

/** One stored revision of an attachment. Previous versions are never overwritten. */
@Entity
@Table(name = "content_file_versions")
public class ContentFileVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_id", nullable = false, updatable = false)
    private Long fileId;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(nullable = false, updatable = false)
    private String name;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    /** Key in the file storage; null when no binary was stored (seed metadata). */
    @Column(name = "storage_key")
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "scan_status", nullable = false, length = 10)
    private FileScanStatus scanStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    protected ContentFileVersion() {
    }

    public ContentFileVersion(Long fileId, int version, String name, long sizeBytes, String storageKey,
            FileScanStatus scanStatus, Instant createdAt, Long createdBy) {
        this.fileId = fileId;
        this.version = version;
        this.name = name;
        this.sizeBytes = sizeBytes;
        this.storageKey = storageKey;
        this.scanStatus = scanStatus;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public Long getFileId() {
        return fileId;
    }

    public int getVersion() {
        return version;
    }

    public String getName() {
        return name;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public FileScanStatus getScanStatus() {
        return scanStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
