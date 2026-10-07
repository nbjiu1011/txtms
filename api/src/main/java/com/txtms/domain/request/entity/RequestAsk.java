package com.txtms.domain.request.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Reviewer question to the requester and its answer. */
@Entity
@Table(name = "request_asks")
public class RequestAsk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_key", updatable = false, length = 10)
    private String contentKey;

    @Column(name = "asked_by", nullable = false, updatable = false)
    private Long askedBy;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String question;

    @Column(name = "asked_at", nullable = false, updatable = false)
    private Instant askedAt;

    @Column(columnDefinition = "text")
    private String answer;

    @Column(name = "answered_by")
    private Long answeredBy;

    @Column(name = "answered_at")
    private Instant answeredAt;

    @Column(nullable = false, updatable = false)
    private int round;

    protected RequestAsk() {
    }

    public RequestAsk(String requestId, String contentKey, Long askedBy, String question, Instant askedAt,
            int round) {
        this.requestId = requestId;
        this.contentKey = contentKey;
        this.askedBy = askedBy;
        this.question = question;
        this.askedAt = askedAt;
        this.round = round;
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

    public Long getAskedBy() {
        return askedBy;
    }

    public String getQuestion() {
        return question;
    }

    public Instant getAskedAt() {
        return askedAt;
    }

    public String getAnswer() {
        return answer;
    }

    public Long getAnsweredBy() {
        return answeredBy;
    }

    public Instant getAnsweredAt() {
        return answeredAt;
    }

    public int getRound() {
        return round;
    }
}
