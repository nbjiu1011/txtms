package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Reviewer opinion on a content (or the whole request when contentKey is null). */
@Entity
@Table(name = "request_opinions")
public class RequestOpinion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_key", updatable = false, length = 10)
    private String contentKey;

    @Column(name = "author_id", nullable = false, updatable = false)
    private Long authorId;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false, updatable = false)
    private int round;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected RequestOpinion() {
    }

    public RequestOpinion(String requestId, String contentKey, Long authorId, String body, int round,
            Instant createdAt) {
        this.requestId = requestId;
        this.contentKey = contentKey;
        this.authorId = authorId;
        this.body = body;
        this.round = round;
        this.createdAt = createdAt;
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

    public Long getAuthorId() {
        return authorId;
    }

    public String getBody() {
        return body;
    }

    public int getRound() {
        return round;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
