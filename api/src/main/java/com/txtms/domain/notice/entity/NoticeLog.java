package com.txtms.domain.notice.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Snapshot of a notice before a change. {@code action} is the Korean label (수정/게시/게시 중지/삭제/복원, older 철회). */
@Entity
@Table(name = "notice_logs")
public class NoticeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "notice_id", nullable = false, updatable = false)
    private Long noticeId;

    @Column(nullable = false, updatable = false)
    private Instant at;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false, length = 20)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_scope", nullable = false, updatable = false, length = 20)
    private NoticeScope previousScope;

    @Column(name = "previous_project_id", updatable = false)
    private Long previousProjectId;

    @Column(name = "previous_title", nullable = false, updatable = false, length = 200)
    private String previousTitle;

    @Column(name = "previous_body", nullable = false, updatable = false, columnDefinition = "mediumtext")
    private String previousBody;

    protected NoticeLog() {
    }

    public NoticeLog(Long noticeId, Instant at, Long actorId, String action, NoticeScope previousScope,
            Long previousProjectId, String previousTitle, String previousBody) {
        this.noticeId = noticeId;
        this.at = at;
        this.actorId = actorId;
        this.action = action;
        this.previousScope = previousScope;
        this.previousProjectId = previousProjectId;
        this.previousTitle = previousTitle;
        this.previousBody = previousBody;
    }

    public Long getId() {
        return id;
    }

    public Long getNoticeId() {
        return noticeId;
    }

    public Instant getAt() {
        return at;
    }

    public Long getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public NoticeScope getPreviousScope() {
        return previousScope;
    }

    public Long getPreviousProjectId() {
        return previousProjectId;
    }

    public String getPreviousTitle() {
        return previousTitle;
    }

    public String getPreviousBody() {
        return previousBody;
    }
}
