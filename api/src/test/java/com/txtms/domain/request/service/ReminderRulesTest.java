package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.repository.RequestReminderRepository.State;
import com.txtms.domain.request.service.ReminderRules.Decision;

/** Re-notification rules: interval, maximum, urgency, reset on a due date change, email on the last urgent one. */
class ReminderRulesTest {

    private static final Duration DAY = Duration.ofHours(24);
    private static final Instant NOW = Instant.parse("2026-10-07T03:00:00Z"); // 12:00 KST
    private static final LocalDate FAR = LocalDate.of(2026, 10, 30);
    private static final LocalDate SOON = LocalDate.of(2026, 10, 9);

    private static Decision decide(State stored, Instant originalAt, LocalDate due, boolean email) {
        return ReminderRules.decide(stored, originalAt, RequestStatus.IN_REVIEW, due, 3, NOW, DAY, 3, email);
    }

    @Test
    void firstReminderComes24HoursAfterTheOriginal() {
        Decision early = decide(null, NOW.minus(DAY).plusSeconds(1), FAR, false);
        assertThat(early.send()).isFalse();
        assertThat(early.state()).isEqualTo(new State(0, NOW.minus(DAY).plusSeconds(1), FAR)); // initial state stored
        Decision due = decide(null, NOW.minus(DAY), FAR, false);
        assertThat(due.send()).isTrue();
        assertThat(due.count()).isEqualTo(1);
        assertThat(due.urgent()).isFalse();
        assertThat(due.state()).isEqualTo(new State(1, NOW, FAR));
    }

    @Test
    void intervalAndMaximum() {
        assertThat(decide(new State(1, NOW.minus(Duration.ofHours(23)), FAR), null, FAR, false).send()).isFalse();
        Decision second = decide(new State(1, NOW.minus(DAY), FAR), null, FAR, false);
        assertThat(second.send()).isTrue();
        assertThat(second.count()).isEqualTo(2);
        Decision stop = decide(new State(3, NOW.minus(Duration.ofDays(10)), FAR), null, FAR, false);
        assertThat(stop.send()).isFalse();
        assertThat(stop.state()).isNull(); // nothing to store
    }

    @Test
    void dueDateChangeResetsTheCount() {
        Decision reset = decide(new State(3, NOW.minus(Duration.ofDays(5)), FAR), null, SOON, false);
        assertThat(reset.send()).isFalse();
        assertThat(reset.state()).isEqualTo(new State(0, NOW, SOON));
        Decision noDue = decide(new State(2, NOW.minus(Duration.ofDays(5)), FAR), null, null, false);
        assertThat(noDue.state()).isEqualTo(new State(0, NOW, null));
    }

    @Test
    void urgencyIncludesOverdueAndUsesTheKstDeadline() {
        // deadline 2026-10-10 23:59:59.999 KST = 2026-10-10T14:59:59.999Z, 3 days = 2026-10-10T03:00Z → not urgent
        assertThat(ReminderRules.urgent(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 10), 3, NOW)).isFalse();
        assertThat(ReminderRules.urgent(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 9), 3, NOW)).isTrue();
        assertThat(ReminderRules.urgent(RequestStatus.WAITING, LocalDate.of(2026, 9, 1), 3, NOW)).isTrue();
        assertThat(ReminderRules.urgent(RequestStatus.APPROVED, LocalDate.of(2026, 9, 1), 3, NOW)).isFalse();
        assertThat(ReminderRules.urgent(RequestStatus.IN_REVIEW, null, 3, NOW)).isFalse();
    }

    @Test
    void urgentWinsTextAndKind() {
        Decision d = decide(new State(0, NOW.minus(DAY), SOON), null, SOON, false);
        assertThat(d.urgent()).isTrue();
        assertThat(ReminderRules.kind(d.urgent(), NotificationKind.ASK)).isEqualTo(NotificationKind.DUE);
        assertThat(ReminderRules.kind(false, NotificationKind.ASK)).isEqualTo(NotificationKind.ASK);
        assertThat(ReminderRules.text(true, 1, 3, "적립 안내")).isEqualTo("납기 임박 재통지 1/3: 적립 안내");
        assertThat(ReminderRules.text(false, 2, 3, "적립 안내")).isEqualTo("미처리 재통지 2/3: 적립 안내");
    }

    @Test
    void onlyTheThirdUrgentReminderIsMailedAndOnlyWithTheEmailChannel() {
        assertThat(decide(new State(1, NOW.minus(DAY), SOON), null, SOON, true).email()).isFalse();
        Decision third = decide(new State(2, NOW.minus(DAY), SOON), null, SOON, true);
        assertThat(third.count()).isEqualTo(3);
        assertThat(third.email()).isTrue();
        assertThat(decide(new State(2, NOW.minus(DAY), SOON), null, SOON, false).email()).isFalse();
        assertThat(decide(new State(2, NOW.minus(DAY), FAR), null, FAR, true).email()).isFalse(); // not urgent
    }
}
