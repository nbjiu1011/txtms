package com.txtms.domain.auth.service;

import java.time.Duration;
import java.time.Instant;

/**
 * Session lifetime rules. A normal session expires after {@code idleTimeout} without activity; a "remember me"
 * session lives {@code rememberDuration} from its start (absolute, activity does not extend it). Activity is written
 * at most once per {@code touchInterval}.
 */
public record SessionExpiryPolicy(Duration idleTimeout, Duration rememberDuration, Duration touchInterval) {

    public Instant expiresAt(boolean remember, Instant startedAt, Instant lastSeenAt) {
        return remember ? startedAt.plus(rememberDuration) : lastSeenAt.plus(idleTimeout);
    }

    public boolean expired(boolean remember, Instant startedAt, Instant lastSeenAt, Instant now) {
        return !now.isBefore(expiresAt(remember, startedAt, lastSeenAt));
    }

    public boolean shouldTouch(Instant lastSeenAt, Instant now) {
        return !now.isBefore(lastSeenAt.plus(touchInterval));
    }
}
