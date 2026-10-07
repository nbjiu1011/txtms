package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Append-only business history entry. {@code action} is the Korean action name shown as-is. */
@Entity
@Table(name = "request_history")
public class RequestHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(nullable = false, updatable = false)
    private Instant at;

    /** Null for system actions (e.g. automatic lock release). */
    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false, length = 50)
    private String action;

    @Column(updatable = false, columnDefinition = "text")
    private String detail;

    @Column(name = "content_key", updatable = false, length = 10)
    private String contentKey;

    @Column(name = "content_title", updatable = false, length = 200)
    private String contentTitle;

    @Column(nullable = false, updatable = false)
    private int round;

    protected RequestHistory() {
    }

    public RequestHistory(String requestId, Instant at, Long actorId, String action, String detail,
            String contentKey, String contentTitle, int round) {
        this.requestId = requestId;
        this.at = at;
        this.actorId = actorId;
        this.action = action;
        this.detail = detail;
        this.contentKey = contentKey;
        this.contentTitle = contentTitle;
        this.round = round;
    }

    public Long getId() {
        return id;
    }

    public String getRequestId() {
        return requestId;
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

    public String getDetail() {
        return detail;
    }

    public String getContentKey() {
        return contentKey;
    }

    public String getContentTitle() {
        return contentTitle;
    }

    public int getRound() {
        return round;
    }
}
