package com.txtms.domain.request.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One frozen content of a completion bundle (payload and FileMeta array as JSON). */
@Entity
@Table(name = "completion_bundle_items")
public class CompletionBundleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_key", nullable = false, updatable = false, length = 10)
    private String contentKey;

    @Column(nullable = false, updatable = false, length = 200)
    private String title;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(nullable = false, updatable = false, columnDefinition = "json")
    private String payload;

    @Column(name = "files_snapshot", nullable = false, updatable = false, columnDefinition = "json")
    private String filesSnapshot;

    @Column(name = "sort_order", nullable = false, updatable = false)
    private int sortOrder;

    protected CompletionBundleItem() {
    }

    public CompletionBundleItem(String requestId, String contentKey, String title, int version, String payload,
            String filesSnapshot, int sortOrder) {
        this.requestId = requestId;
        this.contentKey = contentKey;
        this.title = title == null ? "" : title;
        this.version = version;
        this.payload = payload;
        this.filesSnapshot = filesSnapshot;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getContentKey() {
        return contentKey;
    }

    public String getTitle() {
        return title;
    }

    public int getVersion() {
        return version;
    }

    public String getPayload() {
        return payload;
    }

    public String getFilesSnapshot() {
        return filesSnapshot;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
