package com.txtms.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class SessionExpiryPolicyTest {

    private final SessionExpiryPolicy policy =
            new SessionExpiryPolicy(Duration.ofMinutes(30), Duration.ofDays(14), Duration.ofMinutes(1));
    private final Instant start = Instant.parse("2026-10-07T00:00:00Z");

    @Test
    void normalSessionExpiresThirtyMinutesAfterLastActivity() {
        Instant lastSeen = start.plus(Duration.ofMinutes(50));
        assertThat(policy.expiresAt(false, start, lastSeen)).isEqualTo(start.plus(Duration.ofMinutes(80)));
        assertThat(policy.expired(false, start, lastSeen, lastSeen.plus(Duration.ofMinutes(29)))).isFalse();
        assertThat(policy.expired(false, start, lastSeen, lastSeen.plus(Duration.ofMinutes(30)))).isTrue();
    }

    @Test
    void rememberedSessionIgnoresIdlenessAndEndsFourteenDaysAfterStart() {
        Instant lastSeen = start;
        assertThat(policy.expired(true, start, lastSeen, start.plus(Duration.ofDays(3)))).isFalse();
        Instant recent = start.plus(Duration.ofDays(13));
        assertThat(policy.expiresAt(true, start, recent)).isEqualTo(start.plus(Duration.ofDays(14)));
        assertThat(policy.expired(true, start, recent, start.plus(Duration.ofDays(14)).minusMillis(1))).isFalse();
        assertThat(policy.expired(true, start, recent, start.plus(Duration.ofDays(14)))).isTrue();
    }

    @Test
    void activityIsWrittenAtMostOncePerInterval() {
        assertThat(policy.shouldTouch(start, start.plusSeconds(59))).isFalse();
        assertThat(policy.shouldTouch(start, start.plusSeconds(60))).isTrue();
    }
}
