package com.txtms.domain.request.policy;

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

    /**
     * "D-{dueSoonDays} 이내" in KST calendar days (기획서 8.2 "확정 납기 D-3 이내", 협의 08 KST 날짜 경계): not overdue
     * yet and the due date is at most {@code dueSoonDays} days after today's KST date (D-day included). A request due
     * in three days is due soon from the first minute of today, not only from the same clock time three days ahead.
     */
    public static boolean dueSoon(RequestStatus status, LocalDate dueDate, Instant now, int dueSoonDays) {
        if (!tracked(status, dueDate)) {
            return false;
        }
        return !deadline(dueDate).isBefore(now) && withinDays(dueDate, now, dueSoonDays);
    }

    /** The due date is at most {@code days} KST calendar days after today (past dates included). */
    public static boolean withinDays(LocalDate dueDate, Instant now, int days) {
        return !dueDate.isAfter(Kst.dateOf(now).plusDays(days));
    }

    private static boolean tracked(RequestStatus status, LocalDate dueDate) {
        return dueDate != null && status != RequestStatus.DRAFT && !status.isFinal();
    }
}
