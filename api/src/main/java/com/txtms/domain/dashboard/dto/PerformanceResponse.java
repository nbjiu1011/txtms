package com.txtms.domain.dashboard.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Contract Performance (§9). {@code completionRate} is null when nothing was received (screen "–"). {@code fromDate}
 * and {@code toDate} echo the KST period that was applied (defaults filled in).
 */
public record PerformanceResponse(
        LocalDate fromDate,
        LocalDate toDate,
        List<Long> projectIds,
        int received,
        int receivedContents,
        int receivedCompleted,
        Double completionRate,
        int completedInPeriod,
        int completedContents,
        int inProgress,
        List<PersonRow> people,
        List<WorkloadRow> workload) {

    public record PersonRow(long userId, int completedAsPrimary, int coReviewed, int assignmentsManaged,
            int active) {
    }
}
