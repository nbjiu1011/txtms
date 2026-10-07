package com.txtms.domain.request.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.DueStatus;
import com.txtms.domain.request.repository.RequestReminderRepository.State;

/**
 * Re-notification rules of one request and recipient (pure, actions.md §8.3, prototype {@code processReminders}).
 * <ol>
 * <li>No stored state: count 0, last = the newest original notification, due = the request's due date.</li>
 * <li>The due date differs from the stored one: count 0, last = now (no reminder in this run).</li>
 * <li>{@code count >= maxCount} or less than {@code interval} since last: nothing is sent.</li>
 * <li>Otherwise count + 1, last = now, text {@code {납기 임박|미처리} 재통지 {n}/{max}: {제목}}, kind {@code DUE} when
 * urgent else the original kind. Urgent = not final, a due date, and its deadline (23:59:59.999 KST) is at most
 * {@code dueSoonDays} days away (overdue included). Urgent wins: there is only ever one reminder per run.</li>
 * <li>The {@code maxCount}-th urgent reminder is also mailed when the customer's channel includes email.</li>
 * </ol>
 * Whether the recipient still has work to do ({@code pendingFor}) is decided by the caller.
 */
public final class ReminderRules {

    private ReminderRules() {
    }

    /**
     * @param state      state to store (null = unchanged)
     * @param send       a reminder is due now
     * @param urgent     due soon or overdue
     * @param count      the reminder's number (1..max) when sent
     * @param email      also mail it (last urgent reminder)
     */
    public record Decision(State state, boolean send, boolean urgent, int count, boolean email) {
    }

    public static Decision decide(State stored, Instant originalAt, RequestStatus status, LocalDate dueDate,
            int dueSoonDays, Instant now, Duration interval, int maxCount, boolean emailChannel) {
        State state = stored != null ? stored : new State(0, originalAt, dueDate);
        boolean changed = stored == null;
        if (!Objects.equals(state.dueDate(), dueDate)) {
            state = new State(0, now, dueDate);
            changed = true;
        }
        boolean urgent = urgent(status, dueDate, dueSoonDays, now);
        if (state.count() >= maxCount || Duration.between(state.lastAt(), now).compareTo(interval) < 0) {
            return new Decision(changed ? state : null, false, urgent, state.count(), false);
        }
        State next = new State(state.count() + 1, now, dueDate);
        boolean email = urgent && next.count() == maxCount && emailChannel;
        return new Decision(next, true, urgent, next.count(), email);
    }

    /**
     * Not final, with a due date at most {@code dueSoonDays} KST calendar days after today (D-N 이내, overdue
     * included) — the same day boundary as {@link DueStatus#dueSoon}.
     */
    public static boolean urgent(RequestStatus status, LocalDate dueDate, int dueSoonDays, Instant now) {
        if (status.isFinal() || dueDate == null) {
            return false;
        }
        return DueStatus.withinDays(dueDate, now, dueSoonDays);
    }

    public static String text(boolean urgent, int count, int maxCount, String title) {
        return (urgent ? "납기 임박" : "미처리") + " 재통지 " + count + "/" + maxCount + ": " + title;
    }

    public static NotificationKind kind(boolean urgent, NotificationKind original) {
        return urgent ? NotificationKind.DUE : original;
    }
}
