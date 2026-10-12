package com.txtms.domain.auth.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** A requested email change of an accepted user: applied only when the link mailed to {@code newEmail} is used. */
@Entity
@Table(name = "email_changes")
public class EmailChange extends AccountToken {

    @Column(name = "new_email", nullable = false, updatable = false, length = 255)
    private String newEmail;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    protected EmailChange() {
    }

    public EmailChange(Long userId, String tokenHash, String newEmail, Instant now, Instant expiresAt,
            Long createdBy) {
        super(userId, tokenHash, now, expiresAt);
        this.newEmail = newEmail;
        this.createdBy = createdBy;
    }

    public String getNewEmail() {
        return newEmail;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
