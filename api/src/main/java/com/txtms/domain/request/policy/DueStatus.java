package com.txtms.domain.request.policy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.common.Kst;

/**
 * Due-date evaluation. A due date ends at 23:59:59.999 KST of that day. Drafts and finally completed requests are
 * never due soon or overdue.
 */
public final class DueStatus {

    private DueStatus() {
    }

    public static Instant deadline(LocalDate dueDate) {
        return dueDate.atTime(23, 59, 59, 999_000_000).atZone(Kst.ZONE).toInstant();
    }

    public static boolean overdue(RequestStatus status, LocalDate dueDate, Instant now) {
        return tracked(status, dueDate) && deadline(dueDate).isBefore(now);
    }

    /** Not overdue yet and the deadline is within {@code dueSoonDays} days from now. */
    public static boolean dueSoon(RequestStatus status, LocalDate dueDate, Instant now, int dueSoonDays) {
        if (!tracked(status, dueDate)) {
            return false;
        }
        Instant deadline = deadline(dueDate);
        return !deadline.isBefore(now) && !deadline.isAfter(now.plus(Duration.ofDays(dueSoonDays)));
    }

    private static boolean tracked(RequestStatus status, LocalDate dueDate) {
        return dueDate != null && status != RequestStatus.DRAFT && !status.isFinal();
    }
}
