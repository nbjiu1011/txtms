package com.txtms.domain.contenttype.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Read-only writing guide per content type. JSON columns hold the contract shapes. */
@Entity
@Table(name = "writing_guides")
public class WritingGuide {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ContentType type;

    @Column(nullable = false, columnDefinition = "text")
    private String principles;

    /** JSON array of {@code {avoid, prefer}}. */
    @Column(name = "good_expressions", nullable = false, columnDefinition = "json")
    private String goodExpressions;

    /** JSON array of strings. */
    @Column(nullable = false, columnDefinition = "json")
    private String checklist;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    protected WritingGuide() {
    }

    public WritingGuide(ContentType type, String principles, String goodExpressions, String checklist,
            Instant now) {
        this.type = type;
        this.principles = principles;
        this.goodExpressions = goodExpressions;
        this.checklist = checklist;
        this.updatedAt = now;
    }

    public ContentType getType() {
        return type;
    }

    public String getPrinciples() {
        return principles;
    }

    public String getGoodExpressions() {
        return goodExpressions;
    }

    public String getChecklist() {
        return checklist;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }
}
