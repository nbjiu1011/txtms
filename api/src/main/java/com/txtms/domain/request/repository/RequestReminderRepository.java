package com.txtms.domain.request.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Re-notification state per request and user ({@code request_reminders}): how many reminders were sent, when the
 * last one (or the original notification) was, and the due date the count belongs to.
 */
@Repository
public class RequestReminderRepository {

    /** Stored state of one request and user. */
    public record State(int count, Instant lastAt, LocalDate dueDate) {
    }

    private final JdbcTemplate jdbc;

    public RequestReminderRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<State> find(String requestId, long userId) {
        List<State> rows = jdbc.query(
                "SELECT count, last_at, due_date_snapshot FROM request_reminders WHERE request_id = ? AND user_id = ?",
                (rs, i) -> {
                    LocalDate due = rs.getObject("due_date_snapshot", LocalDate.class);
                    LocalDateTime last = rs.getObject("last_at", LocalDateTime.class);
                    return new State(rs.getInt("count"), last.toInstant(ZoneOffset.UTC), due);
                }, requestId, userId);
        return rows.stream().findFirst();
    }

    /** Inserts or replaces the state (times are stored as UTC like every DATETIME column). */
    public void save(String requestId, long userId, State state) {
        jdbc.update("INSERT INTO request_reminders (request_id, user_id, count, last_at, due_date_snapshot) "
                + "VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE count = VALUES(count), last_at = VALUES(last_at), "
                + "due_date_snapshot = VALUES(due_date_snapshot)",
                requestId, userId, state.count(), LocalDateTime.ofInstant(state.lastAt(), ZoneOffset.UTC),
                state.dueDate());
    }

    /** Forgets every reminder count of the request (a due date change starts the reminders over). */
    public int deleteByRequestId(String requestId) {
        return jdbc.update("DELETE FROM request_reminders WHERE request_id = ?", requestId);
    }
}
