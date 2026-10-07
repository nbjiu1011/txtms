package com.txtms.domain.notification.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** In-app notification. Reading it is independent from finishing the related work. */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private NotificationKind kind;

    @Column(name = "request_id", updatable = false, length = 20)
    private String requestId;

    @Column(nullable = false, updatable = false, length = 500)
    private String text;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(nullable = false, updatable = false)
    private boolean renotify;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(name = "source_notification_id", updatable = false)
    private Long sourceNotificationId;

    protected Notification() {
    }

    public Notification(Long userId, NotificationKind kind, String requestId, String text, Instant createdAt,
            boolean renotify, Long actorId) {
        this.userId = userId;
        this.kind = kind;
        this.requestId = requestId;
        this.text = text;
        this.createdAt = createdAt;
        this.renotify = renotify;
        this.actorId = actorId;
    }

    public void markRead(Instant now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public boolean isRead() {
        return readAt != null;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public NotificationKind getKind() {
        return kind;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getText() {
        return text;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public boolean isRenotify() {
        return renotify;
    }

    public Long getActorId() {
        return actorId;
    }

    public Long getSourceNotificationId() {
        return sourceNotificationId;
    }
}
