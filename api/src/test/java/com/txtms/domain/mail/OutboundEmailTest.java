package com.txtms.domain.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

/** Delivery status transitions of an outbox mail (contract §23). */
class OutboundEmailTest {

    private static final Instant T0 = Instant.parse("2026-10-13T01:00:00Z");
    private static final List<Duration> DELAYS = List.of(Duration.ofMinutes(1), Duration.ofMinutes(5));

    private static OutboundEmail pending() {
        return new OutboundEmail(MailKind.INVITATION, 1L, "a@b.kr", "s", "b", T0, true);
    }

    @Test
    void aDeliverableMailIsDueAtOnceAnUndeliverableOneIsSkipped() {
        OutboundEmail mail = pending();
        assertThat(mail.getStatus()).isEqualTo("PENDING");
        assertThat(mail.getNextAttemptAt()).isEqualTo(T0);
        OutboundEmail skipped = new OutboundEmail(MailKind.REMINDER, 1L, "a@b.kr", "s", "b", T0, false);
        assertThat(skipped.getStatus()).isEqualTo("SKIPPED");
        assertThat(skipped.getNextAttemptAt()).isNull();
    }

    @Test
    void sentRecordsTheTimeAndEndsRetries() {
        OutboundEmail mail = pending();
        mail.markSent(T0.plusSeconds(5));
        assertThat(mail.getStatus()).isEqualTo("SENT");
        assertThat(mail.getSentAt()).isEqualTo(T0.plusSeconds(5));
        assertThat(mail.getAttempts()).isEqualTo(1);
        assertThat(mail.getNextAttemptAt()).isNull();
    }

    @Test
    void failuresRetryAfterEachDelayThenFail() {
        OutboundEmail mail = pending();
        mail.recordFailure("timeout", T0, DELAYS);
        assertThat(mail.getStatus()).isEqualTo("PENDING");
        assertThat(mail.getNextAttemptAt()).isEqualTo(T0.plus(Duration.ofMinutes(1)));
        mail.recordFailure("timeout", T0, DELAYS);
        assertThat(mail.getNextAttemptAt()).isEqualTo(T0.plus(Duration.ofMinutes(5)));
        mail.recordFailure("auth failed", T0, DELAYS);
        assertThat(mail.getStatus()).isEqualTo("FAILED");
        assertThat(mail.getAttempts()).isEqualTo(3);
        assertThat(mail.getNextAttemptAt()).isNull();
        assertThat(mail.getLastError()).isEqualTo("auth failed");
    }

    @Test
    void longErrorsAreCut() {
        OutboundEmail mail = pending();
        mail.recordFailure("x".repeat(800), T0, DELAYS);
        assertThat(mail.getLastError()).hasSize(500);
    }

    @Test
    void finalStatusesCannotChange() {
        OutboundEmail sent = pending();
        sent.markSent(T0);
        assertThatThrownBy(() -> sent.markSent(T0)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> sent.recordFailure("e", T0, DELAYS)).isInstanceOf(IllegalStateException.class);
        OutboundEmail skipped = new OutboundEmail(MailKind.OTHER, null, "a@b.kr", "s", "b", T0, false);
        assertThatThrownBy(() -> skipped.markSent(T0)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(skipped::markSkipped).isInstanceOf(IllegalStateException.class);
    }
}
