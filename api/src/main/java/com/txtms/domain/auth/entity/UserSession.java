package com.txtms.domain.auth.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Server-side session (the source of truth for login state). The refresh cookie carries an opaque token whose
 * SHA-256 is stored here. {@code expiresAt} is kept in sync for display; validity is decided by
 * {@link com.txtms.domain.auth.service.SessionExpiryPolicy}.
 */
@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "refresh_token_hash", nullable = false, length = 64)
    private String refreshTokenHash;

    @Column(nullable = false, updatable = false)
    private boolean remember;

    @Column(nullable = false, updatable = false)
    private boolean demo;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected UserSession() {
    }

    public UserSession(Long userId, String refreshTokenHash, boolean remember, boolean demo, Instant now,
            Instant expiresAt) {
        this.userId = userId;
        this.refreshTokenHash = refreshTokenHash;
        this.remember = remember;
        this.demo = demo;
        this.startedAt = now;
        this.lastSeenAt = now;
        this.expiresAt = expiresAt;
    }

    public void touch(Instant now, Instant newExpiresAt) {
        this.lastSeenAt = now;
        this.expiresAt = newExpiresAt;
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getRefreshTokenHash() {
        return refreshTokenHash;
    }

    public boolean isRemember() {
        return remember;
    }

    public boolean isDemo() {
        return demo;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }
}
