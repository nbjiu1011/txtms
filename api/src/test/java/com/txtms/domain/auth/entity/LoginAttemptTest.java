package com.txtms.domain.auth.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class LoginAttemptTest {

    private static final Duration LOCK = Duration.ofMinutes(15);
    private final Instant now = Instant.parse("2026-10-07T00:00:00Z");

    @Test
    void fifthConsecutiveFailureLocksForFifteenMinutes() {
        LoginAttempt attempt = new LoginAttempt("a@b.c", now);
        for (int i = 0; i < 4; i++) {
            assertThat(attempt.recordFailure(now, 5, LOCK)).isFalse();
        }
        assertThat(attempt.isLocked(now)).isFalse();
        assertThat(attempt.recordFailure(now, 5, LOCK)).isTrue();
        assertThat(attempt.isLocked(now.plus(Duration.ofMinutes(14)))).isTrue();
        assertThat(attempt.isLocked(now.plus(LOCK))).isFalse();
    }

    @Test
    void countingRestartsAfterTheLockExpires() {
        LoginAttempt attempt = new LoginAttempt("a@b.c", now);
        for (int i = 0; i < 5; i++) {
            attempt.recordFailure(now, 5, LOCK);
        }
        Instant later = now.plus(Duration.ofMinutes(16));
        assertThat(attempt.recordFailure(later, 5, LOCK)).isFalse();
        assertThat(attempt.getFailedCount()).isEqualTo(1);
        assertThat(attempt.isLocked(later)).isFalse();
    }
}
