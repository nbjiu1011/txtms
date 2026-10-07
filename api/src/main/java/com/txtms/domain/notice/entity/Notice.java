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

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "author_id", nullable = false, updatable = false)
    private Long authorId;

    @Column(nullable = false)
    private boolean edited;

    @Column(nullable = false)
    private boolean withdrawn;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    protected Notice() {
    }

    public Notice(NoticeScope scope, Long customerId, Long projectId, String title, String body, Long authorId,
            Instant now) {
        if (scope == NoticeScope.PROJECT && projectId == null) {
            throw new IllegalArgumentException("project notice needs a project");
        }
        this.scope = scope;
        this.customerId = customerId;
        this.projectId = scope == NoticeScope.PROJECT ? projectId : null;
        this.title = title;
        this.body = body;
        this.authorId = authorId;
        initTimestamps(now);
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

    public boolean isWithdrawn() {
        return withdrawn;
    }

    public Instant getWithdrawnAt() {
        return withdrawnAt;
    }
}
