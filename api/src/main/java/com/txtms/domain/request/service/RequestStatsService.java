package com.txtms.domain.request.service;

import java.util.HashMap;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Request counts per customer for the operator overview (numbers only; the operator never reads request content).
 */
@Service
@Transactional(readOnly = true)
public class RequestStatsService {

    /**
     * {@code active}: submitted and not finally completed ({@code WAITING}…{@code APPROVAL_WAITING});
     * {@code completed}: {@code REVIEW_COMPLETED} or {@code APPROVED}; {@code sample}: demo requests. Drafts (and
     * cancelled requests, which are drafts) count in {@code total} only.
     */
    public record RequestCounts(long total, long active, long completed, long sample) {

        public static final RequestCounts NONE = new RequestCounts(0, 0, 0, 0);
    }

    private final JdbcTemplate jdbc;

    public RequestStatsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<Long, RequestCounts> countsByCustomer() {
        Map<Long, RequestCounts> result = new HashMap<>();
        jdbc.query("SELECT p.customer_id, COUNT(*), "
                + "SUM(CASE WHEN r.status IN ('WAITING', 'IN_REVIEW', 'CONFIRMING', 'APPROVAL_WAITING') THEN 1 ELSE 0 END), "
                + "SUM(CASE WHEN r.status IN ('REVIEW_COMPLETED', 'APPROVED') THEN 1 ELSE 0 END), "
                + "SUM(CASE WHEN r.demo THEN 1 ELSE 0 END) "
                + "FROM requests r JOIN projects p ON p.id = r.project_id GROUP BY p.customer_id",
                rs -> {
                    result.put(rs.getLong(1), new RequestCounts(rs.getLong(2), rs.getLong(3), rs.getLong(4),
                            rs.getLong(5)));
                });
        return result;
    }

    public RequestCounts countsOf(long customerId) {
        return countsByCustomer().getOrDefault(customerId, RequestCounts.NONE);
    }
}
