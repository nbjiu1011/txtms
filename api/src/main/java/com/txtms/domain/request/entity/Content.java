package com.txtms.domain.request.entity;

import java.time.Instant;

import com.txtms.global.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Review target inside a request, identified by {@code key} (C1, C2, ...). Payload is ContentPayload JSON. */
@Entity
@Table(name = "contents")
public class Content extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_key", nullable = false, updatable = false, length = 10)
    private String key;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "json")
    private String payload;

    @Column(nullable = false)
    private int version;

    @Column(name = "lock_user_id")
    private Long lockUserId;

    @Column(name = "lock_at")
    private Instant lockAt;

    @Column(name = "saved_at")
    private Instant savedAt;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "parent_request_id", length = 20)
    private String parentRequestId;

    @Column(name = "parent_content_key", length = 10)
    private String parentContentKey;

    protected Content() {
    }

    public Content(String requestId, String key, String title, String payload, int sortOrder, Instant now) {
        this.requestId = requestId;
        this.key = key;
        this.title = title == null ? "" : title;
        this.payload = payload;
        this.version = 1;
        this.sortOrder = sortOrder;
        initTimestamps(now);
    }

    /** Seeding only: content version reached through revisions. */
    public void restoreSeedVersion(int version) {
        this.version = version;
    }

    /** Draft autosave: replaces title and payload without a new version. */
    public void saveDraft(String title, String payload, Instant now) {
        this.title = title == null ? "" : title;
        this.payload = payload;
        this.savedAt = now;
        touch(now);
    }

    /** Type change: the content starts over with the blank payload of the new type. */
    public void reset(String title, String payload, Instant now) {
        this.title = title == null ? "" : title;
        this.payload = payload;
        this.version = 1;
        this.savedAt = now;
        touch(now);
    }

    /** Draft deletion. The row stays so the content key is never reused. */
    public void markDeleted(Instant now) {
        this.deleted = true;
        touch(now);
    }

    /** First submission: every content starts at version 1. */
    public void startVersioning(Instant now) {
        this.version = 1;
        touch(now);
    }

    public void bumpVersion(Instant now) {
        this.version++;
        touch(now);
    }

    /** Lock held by someone other than {@code userId} that has not expired. */
    public boolean lockedByOther(long userId, Instant now, java.time.Duration ttl) {
        return lockUserId != null && lockUserId != userId && lockAt != null && lockAt.plus(ttl).isAfter(now);
    }

    /** Key number: C12 → 12. */
    public int keyNumber() {
        return keyNumber(key);
    }

    public static int keyNumber(String key) {
        try {
            return Integer.parseInt(key.substring(1));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    public void acquireLock(Long userId, Instant now) {
        this.lockUserId = userId;
        this.lockAt = now;
    }

    public void linkParent(String parentRequestId, String parentContentKey) {
        this.parentRequestId = parentRequestId;
        this.parentContentKey = parentContentKey;
    }

    public Long getId() {
        return id;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getKey() {
        return key;
    }

    public String getTitle() {
        return title;
    }

    public String getPayload() {
        return payload;
    }

    public int getVersion() {
        return version;
    }

    public Long getLockUserId() {
        return lockUserId;
    }

    public Instant getLockAt() {
        return lockAt;
    }

    public Instant getSavedAt() {
        return savedAt;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public String getParentRequestId() {
        return parentRequestId;
    }

    public String getParentContentKey() {
        return parentContentKey;
    }
}
