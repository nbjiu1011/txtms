package com.txtms.domain.dashboard.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.common.Kst;

/**
 * Performance statistics (pure, plan §29, screens-b §4 with the planning corrections of actions.md §10 #27).
 * <ul>
 * <li>Counted requests: not demo, not cancelled, not currently a draft (a recalled request counts again once it is
 * resubmitted; its first submission time is kept, so it is one request).</li>
 * <li>Received: submitted within the period (KST, end date inclusive). Completion rate = received requests that are
 * final now ÷ received, one decimal, {@code null} when nothing was received.</li>
 * <li>Completed in period: final completion time within the period. In progress: waiting, in review, confirming,
 * approval waiting (not period bound).</li>
 * <li>People (both period bounds apply): completed as primary = requests with a {@code 검수 완료} entry by the user
 * in the period; co-reviewed = requests finally completed in the period with the user among the assigned
 * reviewers; assignments managed = {@code 검수자 배정}/{@code 검수자 변경} entries by the user in the period;
 * active = assigned requests in review, confirming or approval waiting.</li>
 * </ul>
 */
public final class PerformanceCalculator {

    public static final String COMPLETE_ACTION = "검수 완료";
    public static final Set<String> ASSIGNMENT_ACTIONS = Set.of("검수자 배정", "검수자 변경");

    private static final Set<RequestStatus> IN_PROGRESS = Set.of(RequestStatus.WAITING, RequestStatus.IN_REVIEW,
            RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);
    private static final Set<RequestStatus> ACTIVE_REVIEW = Set.of(RequestStatus.IN_REVIEW, RequestStatus.CONFIRMING,
            RequestStatus.APPROVAL_WAITING);

    private PerformanceCalculator() {
    }

    /** One request with what the statistics need. */
    public record RequestRow(String id, RequestStatus status, boolean demo, boolean cancelled, Instant submittedAt,
            Instant completedAt, int contents, List<Long> reviewerIds) {
    }

    /** One history entry ({@code 검수 완료}, {@code 검수자 배정}, {@code 검수자 변경}). */
    public record HistoryRow(String requestId, Long actorId, String action, Instant at) {
    }

    /** Half-open instant range {@code [from, until)}. */
    public record Period(Instant from, Instant until) {

        /** KST calendar days {@code fromDate}..{@code toDate}, both inclusive. */
        public static Period kst(LocalDate fromDate, LocalDate toDate) {
            return new Period(fromDate.atStartOfDay(Kst.ZONE).toInstant(),
                    toDate.plusDays(1).atStartOfDay(Kst.ZONE).toInstant());
        }

        public boolean contains(Instant at) {
            return at != null && !at.isBefore(from) && at.isBefore(until);
        }
    }

    public record Person(long userId, int completedAsPrimary, int coReviewed, int assignmentsManaged, int active) {
    }

    public record Result(int received, int receivedContents, int receivedCompleted, Double completionRate,
            int completedInPeriod, int completedContents, int inProgress, List<Person> people) {
    }

    public static Result compute(Collection<RequestRow> rows, Collection<HistoryRow> history, List<Long> people,
            Period period) {
        List<RequestRow> counted = rows.stream()
                .filter(r -> !r.demo() && !r.cancelled() && r.status() != RequestStatus.DRAFT)
                .toList();
        Set<String> countedIds = new HashSet<>();
        counted.forEach(r -> countedIds.add(r.id()));

        List<RequestRow> received = counted.stream().filter(r -> period.contains(r.submittedAt())).toList();
        int receivedCompleted = (int) received.stream().filter(r -> r.status().isFinal()).count();
        List<RequestRow> completed = counted.stream()
                .filter(r -> r.status().isFinal() && period.contains(r.completedAt()))
                .toList();
        int inProgress = (int) counted.stream().filter(r -> IN_PROGRESS.contains(r.status())).count();

        List<Person> persons = new ArrayList<>();
        for (long user : people) {
            Set<String> primaryDone = new HashSet<>();
            int assignments = 0;
            for (HistoryRow h : history) {
                if (!countedIds.contains(h.requestId()) || h.actorId() == null || h.actorId() != user
                        || !period.contains(h.at())) {
                    continue;
                }
                if (COMPLETE_ACTION.equals(h.action())) {
                    primaryDone.add(h.requestId());
                } else if (ASSIGNMENT_ACTIONS.contains(h.action())) {
                    assignments++;
                }
            }
            int co = (int) completed.stream().filter(r -> r.reviewerIds().contains(user)).count();
            int active = (int) counted.stream()
                    .filter(r -> ACTIVE_REVIEW.contains(r.status()) && r.reviewerIds().contains(user))
                    .count();
            persons.add(new Person(user, primaryDone.size(), co, assignments, active));
        }
        return new Result(received.size(), contents(received), receivedCompleted,
                rate(receivedCompleted, received.size()), completed.size(), contents(completed), inProgress,
                persons);
    }

    /** Percentage with one decimal (half up), {@code null} for a zero denominator (screen {@code –}). */
    static Double rate(int done, int total) {
        if (total == 0) {
            return null;
        }
        return BigDecimal.valueOf(done * 100L).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static int contents(List<RequestRow> rows) {
        return rows.stream().mapToInt(RequestRow::contents).sum();
    }
}
