package com.txtms.domain.notice.entity;

import java.time.Instant;

import com.txtms.global.common.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Customer-wide or project notice written by a customer admin. */
@Entity
@Table(name = "notices")
public class Notice extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NoticeScope scope;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private Long customerId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "mediumtext")
    private String body;

    @Column(name = "author_id", nullable = false, updatable = false)
    private Long authorId;

    @Column(nullable = false)
    private boolean edited;

    @Column(nullable = false)
    private boolean published;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Notice() {
    }

    public Notice(NoticeScope scope, Long customerId, Long projectId, String title, String body, Long authorId,
            boolean published, Instant now) {
        if (scope == NoticeScope.PROJECT && projectId == null) {
            throw new IllegalArgumentException("project notice needs a project");
        }
        this.scope = scope;
        this.customerId = customerId;
        this.projectId = scope == NoticeScope.PROJECT ? projectId : null;
        this.title = title;
        this.body = body;
        this.authorId = authorId;
        this.published = published;
        this.publishedAt = published ? now : null;
        initTimestamps(now);
    }

    /** Overwrites the notice (the caller logs the previous snapshot first). */
    public void edit(NoticeScope scope, Long projectId, String title, String body, Instant now) {
        requireNotDeleted();
        if (scope == NoticeScope.PROJECT && projectId == null) {
            throw new IllegalArgumentException("project notice needs a project");
        }
        this.scope = scope;
        this.projectId = scope == NoticeScope.PROJECT ? projectId : null;
        this.title = title;
        this.body = body;
        this.edited = true;
        touch(now);
    }

    /** Unpublished → published (users see it from now on, ordered by this time). */
    public void publish(Instant now) {
        requireNotDeleted();
        if (published) {
            throw new IllegalStateException("already published");
        }
        this.published = true;
        this.publishedAt = now;
        touch(now);
    }

    /** Published → unpublished (hidden from users; {@code publishedAt} is kept). */
    public void unpublish(Instant now) {
        requireNotDeleted();
        if (!published) {
            throw new IllegalStateException("not published");
        }
        this.published = false;
        touch(now);
    }

    /** Soft delete: hidden everywhere but the admin's deleted list; a published notice is unpublished as well. */
    public void delete(Instant now) {
        if (deleted) {
            throw new IllegalStateException("already deleted");
        }
        this.deleted = true;
        this.deletedAt = now;
        this.published = false;
        touch(now);
    }

    /** Deleted → kept unpublished, so restoring alone never shows the notice to users again. */
    public void restore(Instant now) {
        if (!deleted) {
            throw new IllegalStateException("not deleted");
        }
        this.deleted = false;
        this.deletedAt = null;
        touch(now);
    }

    private void requireNotDeleted() {
        if (deleted) {
            throw new IllegalStateException("deleted notice");
        }
    }

    public Long getId() {
        return id;
    }

    public NoticeScope getScope() {
        return scope;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public boolean isEdited() {
        return edited;
    }

    public boolean isPublished() {
        return published;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
