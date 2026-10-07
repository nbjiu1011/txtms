package com.txtms.domain.auth.entity;

import java.time.Duration;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Consecutive login failures of one normalized email (tracked for unknown emails as well). */
@Entity
@Table(name = "login_attempts")
public class LoginAttempt {

    @Id
    @Column(length = 255)
    private String email;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "last_failed_at", nullable = false)
    private Instant lastFailedAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    protected LoginAttempt() {
    }

    public LoginAttempt(String email, Instant now) {
        this.email = email;
        this.lastFailedAt = now;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && now.isBefore(lockedUntil);
    }

    /**
     * Records a failure. Reaching {@code maxFailures} locks the email for {@code lockDuration}.
     *
     * @return true when this failure started a lock
     */
    public boolean recordFailure(Instant now, int maxFailures, Duration lockDuration) {
        if (lockedUntil != null && !now.isBefore(lockedUntil)) {
            // previous lock expired: start counting again
            lockedUntil = null;
            failedCount = 0;
        }
        failedCount++;
        lastFailedAt = now;
        if (failedCount >= maxFailures) {
            lockedUntil = now.plus(lockDuration);
            failedCount = 0;
            return true;
        }
        return false;
    }

    public String getEmail() {
        return email;
    }

    public int getFailedCount() {
        return failedCount;
    }

    public Instant getLastFailedAt() {
        return lastFailedAt;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }
}
