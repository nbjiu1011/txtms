package com.txtms.domain.auth.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_invitations")
public class UserInvitation extends AccountToken {

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    protected UserInvitation() {
    }

    public UserInvitation(Long userId, String tokenHash, Instant now, Instant expiresAt, Long createdBy) {
        super(userId, tokenHash, now, expiresAt);
        this.createdBy = createdBy;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}
