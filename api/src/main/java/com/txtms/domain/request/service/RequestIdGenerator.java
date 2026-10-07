package com.txtms.domain.request.service;

import java.time.Instant;
import java.time.ZonedDateTime;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.global.common.Kst;

/**
 * Request ids {@code REQ-{YYMM in KST}-{seq}}. The sequence is one global counter (it does not restart every
 * month), at least three digits. The increment is a single atomic upsert; {@code LAST_INSERT_ID(expr)} hands the new
 * value back on the same connection, so concurrent creators never get the same number.
 */
@Component
public class RequestIdGenerator {

    static final String SEQUENCE = "REQUEST";

    private final JdbcTemplate jdbc;

    public RequestIdGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String next(Instant now) {
        jdbc.update("INSERT INTO request_sequences (name, seq_value) VALUES (?, LAST_INSERT_ID(1)) "
                + "ON DUPLICATE KEY UPDATE seq_value = LAST_INSERT_ID(seq_value + 1)", SEQUENCE);
        Long seq = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        return format(now, seq == null ? 0 : seq);
    }

    public static String format(Instant now, long seq) {
        ZonedDateTime kst = now.atZone(Kst.ZONE);
        return String.format("REQ-%02d%02d-%03d", kst.getYear() % 100, kst.getMonthValue(), seq);
    }
}
