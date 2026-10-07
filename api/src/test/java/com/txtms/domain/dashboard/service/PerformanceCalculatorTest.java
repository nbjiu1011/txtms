package com.txtms.domain.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.dashboard.service.PerformanceCalculator.HistoryRow;
import com.txtms.domain.dashboard.service.PerformanceCalculator.Period;
import com.txtms.domain.dashboard.service.PerformanceCalculator.RequestRow;
import com.txtms.domain.dashboard.service.PerformanceCalculator.Result;
import com.txtms.domain.request.entity.RequestStatus;

/** Performance statistics: KST period boundaries, exclusions, completion rate, people rows. */
class PerformanceCalculatorTest {

    /** 2026-10-01 .. 2026-10-07 KST = [2026-09-30T15:00Z, 2026-10-07T15:00Z). */
    private static final Period WEEK = Period.kst(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7));

    private static RequestRow row(String id, RequestStatus status, String submittedAt, String completedAt,
            int contents, Long... reviewers) {
        return new RequestRow(id, status, false, false, submittedAt == null ? null : Instant.parse(submittedAt),
                completedAt == null ? null : Instant.parse(completedAt), contents, List.of(reviewers));
    }

    @Test
    void periodIsKstCalendarDaysWithTheEndDateIncluded() {
        assertThat(WEEK.from()).isEqualTo(Instant.parse("2026-09-30T15:00:00Z"));
        assertThat(WEEK.until()).isEqualTo(Instant.parse("2026-10-07T15:00:00Z"));
        assertThat(WEEK.contains(Instant.parse("2026-09-30T14:59:59.999999Z"))).isFalse(); // 9/30 23:59 KST
        assertThat(WEEK.contains(Instant.parse("2026-09-30T15:00:00Z"))).isTrue();          // 10/1 00:00 KST
        assertThat(WEEK.contains(Instant.parse("2026-10-07T14:59:59.999999Z"))).isTrue();   // 10/7 23:59 KST
        assertThat(WEEK.contains(Instant.parse("2026-10-07T15:00:00Z"))).isFalse();         // 10/8 00:00 KST
        assertThat(WEEK.contains(null)).isFalse();
    }

    @Test
    void receivedCompletedRateAndInProgress() {
        List<RequestRow> rows = List.of(
                row("R1", RequestStatus.REVIEW_COMPLETED, "2026-10-01T01:00:00Z", "2026-10-03T01:00:00Z", 2, 2L),
                row("R2", RequestStatus.IN_REVIEW, "2026-10-02T01:00:00Z", null, 3, 2L, 3L),
                row("R3", RequestStatus.WAITING, "2026-10-07T14:00:00Z", null, 1),
                // received before the period, completed inside it
                row("R4", RequestStatus.APPROVED, "2026-09-20T01:00:00Z", "2026-10-05T01:00:00Z", 4, 3L),
                // received inside, completed after the period: received and final now, not completed in period
                row("R5", RequestStatus.REVIEW_COMPLETED, "2026-10-06T01:00:00Z", "2026-10-09T01:00:00Z", 1, 2L),
                row("R6", RequestStatus.APPROVAL_WAITING, "2026-09-01T01:00:00Z", null, 1, 2L));
        Result r = PerformanceCalculator.compute(rows, List.of(), List.of(), WEEK);
        assertThat(r.received()).isEqualTo(4);            // R1 R2 R3 R5
        assertThat(r.receivedContents()).isEqualTo(7);
        assertThat(r.receivedCompleted()).isEqualTo(2);   // R1 R5
        assertThat(r.completionRate()).isEqualTo(50.0);
        assertThat(r.completedInPeriod()).isEqualTo(2);   // R1 R4
        assertThat(r.completedContents()).isEqualTo(6);
        assertThat(r.inProgress()).isEqualTo(3);          // R2 R3 R6
    }

    @Test
    void zeroDenominatorIsNullAndRateHasOneDecimal() {
        assertThat(PerformanceCalculator.compute(List.of(), List.of(), List.of(), WEEK).completionRate()).isNull();
        assertThat(PerformanceCalculator.rate(1, 3)).isEqualTo(33.3);
        assertThat(PerformanceCalculator.rate(2, 3)).isEqualTo(66.7);
        assertThat(PerformanceCalculator.rate(3, 3)).isEqualTo(100.0);
        assertThat(PerformanceCalculator.rate(0, 5)).isEqualTo(0.0);
    }

    @Test
    void demoCancelledAndDraftsAreExcludedAndARecalledRequestCountsOnce() {
        List<RequestRow> rows = List.of(
                new RequestRow("DEMO", RequestStatus.WAITING, true, false, Instant.parse("2026-10-02T01:00:00Z"),
                        null, 1, List.of()),
                // cancelled before assignment: back to draft with the cancelled flag
                new RequestRow("CANCEL", RequestStatus.DRAFT, false, true, Instant.parse("2026-10-02T01:00:00Z"),
                        null, 1, List.of()),
                // recalled and not resubmitted yet: a draft again
                row("RECALLED", RequestStatus.DRAFT, "2026-10-02T01:00:00Z", null, 1),
                // recalled and resubmitted: one request, first submission time kept
                row("RESUBMIT", RequestStatus.WAITING, "2026-10-02T01:00:00Z", null, 2));
        Result r = PerformanceCalculator.compute(rows, List.of(), List.of(), WEEK);
        assertThat(r.received()).isEqualTo(1);
        assertThat(r.receivedContents()).isEqualTo(2);
        assertThat(r.inProgress()).isEqualTo(1);
    }

    @Test
    void peopleRowsUseBothPeriodBounds() {
        List<RequestRow> rows = List.of(
                row("R1", RequestStatus.REVIEW_COMPLETED, "2026-10-01T01:00:00Z", "2026-10-03T01:00:00Z", 1, 2L, 3L),
                row("R2", RequestStatus.APPROVAL_WAITING, "2026-10-01T01:00:00Z", null, 1, 2L),
                row("R3", RequestStatus.REVIEW_COMPLETED, "2026-10-01T01:00:00Z", "2026-10-09T01:00:00Z", 1, 2L),
                row("R4", RequestStatus.CONFIRMING, "2026-10-01T01:00:00Z", null, 1, 3L),
                new RequestRow("CANCELLED", RequestStatus.DRAFT, false, true, Instant.parse("2026-10-01T01:00:00Z"),
                        null, 1, List.of()));
        List<HistoryRow> history = List.of(
                new HistoryRow("R1", 2L, "검수 완료", Instant.parse("2026-10-03T01:00:00Z")),
                new HistoryRow("R1", 2L, "검수 완료", Instant.parse("2026-10-03T02:00:00Z")), // same request once
                new HistoryRow("R2", 2L, "검수 완료", Instant.parse("2026-10-04T01:00:00Z")), // approval waiting
                new HistoryRow("R3", 2L, "검수 완료", Instant.parse("2026-10-08T01:00:00Z")), // after the end date
                new HistoryRow("R1", 9L, "검수자 배정", Instant.parse("2026-10-01T02:00:00Z")),
                new HistoryRow("R4", 9L, "검수자 변경", Instant.parse("2026-10-07T14:59:00Z")),
                new HistoryRow("R4", 9L, "검수자 변경", Instant.parse("2026-09-30T14:00:00Z")), // before the start
                new HistoryRow("CANCELLED", 9L, "검수자 배정", Instant.parse("2026-10-02T01:00:00Z")),
                new HistoryRow("R1", null, "검수 완료", Instant.parse("2026-10-03T01:00:00Z")));
        Result r = PerformanceCalculator.compute(rows, history, List.of(2L, 3L, 9L), WEEK);
        assertThat(r.people()).extracting(p -> p.userId() + ":" + p.completedAsPrimary() + "/" + p.coReviewed() + "/"
                + p.assignmentsManaged() + "/" + p.active())
                .containsExactly("2:2/1/0/1", "3:0/1/0/1", "9:0/0/2/0");
    }
}
