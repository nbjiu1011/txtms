package com.txtms.domain.request.service;

import java.time.Duration;
import java.time.Instant;

/**
 * Content edit lock rules (pure). A lock is held by one user while the request is not a draft and expires when
 * there was no input for the idle time ({@code now - lockAt >= ttl}); every input refreshes {@code lockAt}.
 */
public final class EditLocks {

    /** Lock state as seen by one user. */
    public enum State {
        /** No lock. */
        FREE,
        /** Valid lock of this user. */
        MINE,
        /** A lock whose idle time ran out (whoever held it): free to take, to be logged as an automatic release. */
        EXPIRED,
        /** Valid lock of someone else. */
        OTHER
    }

    private EditLocks() {
    }

    public static State state(Long lockUserId, Instant lockAt, long userId, Instant now, Duration ttl) {
        if (lockUserId == null) {
            return State.FREE;
        }
        if (expired(lockAt, now, ttl)) {
            return State.EXPIRED;
        }
        return lockUserId == userId ? State.MINE : State.OTHER;
    }

    /** No input for the idle time (a lock without a time is treated as expired). */
    public static boolean expired(Instant lockAt, Instant now, Duration ttl) {
        return lockAt == null || !lockAt.plus(ttl).isAfter(now);
    }

    /** Lock times at or before this instant are expired. */
    public static Instant expiredBefore(Instant now, Duration ttl) {
        return now.minus(ttl);
    }
}
