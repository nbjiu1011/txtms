package com.txtms.domain.correction.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * "건의하기" on a correction result (screen design ④). Stored only; processing the suggestions is Phase 2.
 * {@code ruleIds} is a JSON array of rule ids.
 */
@Entity
@Table(name = "correction_suggestions")
public class CorrectionSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, updatable = false, length = 20)
    private String requestId;

    @Column(name = "content_key", nullable = false, updatable = false, length = 10)
    private String contentKey;

    @Column(name = "matched_text", nullable = false, updatable = false, columnDefinition = "text")
    private String matchedText;

    @Column(name = "rule_ids", nullable = false, updatable = false, columnDefinition = "json")
    private String ruleIds;

    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String body;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CorrectionSuggestion() {
    }

    public CorrectionSuggestion(String requestId, String contentKey, String matchedText, String ruleIds, String body,
            Long createdBy, Instant createdAt) {
        this.requestId = requestId;
        this.contentKey = contentKey;
        this.matchedText = matchedText;
        this.ruleIds = ruleIds;
        this.body = body;
        this.createdBy = createdBy;
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

    public String getMatchedText() {
        return matchedText;
    }

    public String getRuleIds() {
        return ruleIds;
    }

    public String getBody() {
        return body;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
