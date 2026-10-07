package com.txtms.domain.request.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Re-notification state per request and user ({@code request_reminders}). The reminder scheduler that fills it
 * comes with the work management milestone; until then only the reset on a due date change is needed.
 */
@Repository
public class RequestReminderRepository {

    private final JdbcTemplate jdbc;

    public RequestReminderRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Forgets every reminder count of the request (a due date change starts the reminders over). */
    public int deleteByRequestId(String requestId) {
        return jdbc.update("DELETE FROM request_reminders WHERE request_id = ?", requestId);
    }
}
