package com.txtms.domain.auth.entity;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "password_resets")
public class PasswordReset extends AccountToken {

    protected PasswordReset() {
    }

    public PasswordReset(Long userId, String tokenHash, Instant now, Instant expiresAt) {
        super(userId, tokenHash, now, expiresAt);
    }
}
