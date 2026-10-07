package com.txtms.domain.request.policy;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.txtms.domain.request.entity.RequestStatus;

/** Due dates end at 23:59:59.999 KST (= 14:59:59.999 UTC of the same date). */
class DueStatusTest {

    private static final LocalDate DUE = LocalDate.of(2026, 10, 7);

    @Test
    void deadlineIsEndOfKstDay() {
        assertThat(DueStatus.deadline(DUE)).isEqualTo(Instant.parse("2026-10-07T14:59:59.999Z"));
    }

    @Test
    void overdueStartsAtKstMidnightOfTheNextDay() {
        assertThat(DueStatus.overdue(RequestStatus.IN_REVIEW, DUE, Instant.parse("2026-10-07T14:59:59.999Z")))
                .isFalse();
        assertThat(DueStatus.overdue(RequestStatus.IN_REVIEW, DUE, Instant.parse("2026-10-07T15:00:00Z"))).isTrue();
    }

    @Test
    void utcDateDiffersFromKstDateAroundMidnight() {
        // 2026-10-07T23:30 KST is still 2026-10-07 in KST although UTC says 14:30 of the same day
        Instant lateEvening = Instant.parse("2026-10-07T14:30:00Z");
        assertThat(DueStatus.overdue(RequestStatus.IN_REVIEW, DUE, lateEvening)).isFalse();
        // 2026-10-08T00:30 KST is 2026-10-07T15:30 UTC: the 7th is already over in KST
        Instant afterMidnight = Instant.parse("2026-10-07T15:30:00Z");
        assertThat(DueStatus.overdue(RequestStatus.IN_REVIEW, DUE, afterMidnight)).isTrue();
    }

    @Test
    void dueSoonCountsKstCalendarDaysIncludingTheDueDay() {
        LocalDate due = LocalDate.of(2026, 10, 10);
        // D-4 until 2026-10-06 23:59:59.999 KST (= 14:59:59.999Z), D-3 from 2026-10-07 00:00 KST (= 2026-10-06T15:00Z)
        assertThat(DueStatus.dueSoon(RequestStatus.IN_REVIEW, due, Instant.parse("2026-10-06T14:59:59.999Z"), 3))
                .as("D-4").isFalse();
        assertThat(DueStatus.dueSoon(RequestStatus.IN_REVIEW, due, Instant.parse("2026-10-06T15:00:00Z"), 3))
                .as("D-3 from KST midnight").isTrue();
        assertThat(DueStatus.dueSoon(RequestStatus.IN_REVIEW, due, Instant.parse("2026-10-07T01:00:00Z"), 3))
                .as("D-3 in the morning (KST 10:00), not only after the same clock time").isTrue();
        assertThat(DueStatus.dueSoon(RequestStatus.IN_REVIEW, due, Instant.parse("2026-10-10T14:59:59.999Z"), 3))
                .as("D-day").isTrue();
        assertThat(DueStatus.dueSoon(RequestStatus.IN_REVIEW, due, Instant.parse("2026-10-10T15:00:00Z"), 3))
                .as("overdue is not due soon").isFalse();
    }

    @Test
    void dueSoonDaysComeFromTheCustomer() {
        LocalDate due = LocalDate.of(2026, 10, 9);
        Instant now = Instant.parse("2026-10-07T01:00:00Z");
        assertThat(DueStatus.dueSoon(RequestStatus.WAITING, due, now, 1)).isFalse();
        assertThat(DueStatus.dueSoon(RequestStatus.WAITING, due, now, 3)).isTrue();
    }

    @Test
    void draftsFinalRequestsAndMissingDatesAreNeverFlagged() {
        Instant late = Instant.parse("2026-12-01T00:00:00Z");
        assertThat(DueStatus.overdue(RequestStatus.DRAFT, DUE, late)).isFalse();
        assertThat(DueStatus.overdue(RequestStatus.APPROVED, DUE, late)).isFalse();
        assertThat(DueStatus.overdue(RequestStatus.REVIEW_COMPLETED, DUE, late)).isFalse();
        assertThat(DueStatus.overdue(RequestStatus.IN_REVIEW, null, late)).isFalse();
        assertThat(DueStatus.dueSoon(RequestStatus.DRAFT, DUE, Instant.parse("2026-10-07T00:00:00Z"), 3)).isFalse();
        assertThat(DueStatus.overdue(RequestStatus.APPROVAL_WAITING, DUE, late)).isTrue();
        assertThat(DueStatus.overdue(RequestStatus.CONFIRMING, DUE, late)).isTrue();
    }
}
