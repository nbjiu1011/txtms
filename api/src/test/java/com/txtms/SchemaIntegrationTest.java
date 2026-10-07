package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.txtms.domain.auth.service.InvitationService;
import com.txtms.domain.request.service.ReminderRules;
import com.txtms.support.IntegrationTestConfig;

/** Flyway migrates an empty database and Hibernate validates every entity against it. */
@Tag("integration")
@SpringBootTest
@ActiveProfiles("it")
@Import(IntegrationTestConfig.class)
class SchemaIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void migratesAndValidates() {
        Integer applied = jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success = 1", Integer.class);
        assertThat(applied).isPositive();
    }

    /** The outbox kind backfill of V4 classifies mails queued before the column existed by their subject. */
    @Test
    void outboxKindBackfillClassifiesBySubject() throws IOException {
        String marker = "backfill-" + System.nanoTime() + "@kind.test";
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put(InvitationService.SUBJECT, "INVITATION");
        expected.put("TX TMS 비밀번호 재설정", "PASSWORD_RESET");
        expected.put(ReminderRules.text(false, 1, 3, "적립 안내"), "REMINDER");
        expected.put(ReminderRules.text(true, 3, 3, "적립 안내"), "REMINDER");
        expected.put("공지 안내", "OTHER");
        LocalDateTime now = LocalDateTime.of(2026, 10, 1, 0, 0);
        expected.keySet().forEach(subject -> jdbc.update("INSERT INTO outbound_emails (customer_id, to_address, "
                + "subject, body, status, created_at) VALUES (NULL, ?, ?, 'b', 'PENDING', ?)", marker, subject, now));
        assertThat(jdbc.queryForList("SELECT DISTINCT kind FROM outbound_emails WHERE to_address = ?", String.class,
                marker)).containsExactly("OTHER");

        String backfill;
        try (InputStream in = new ClassPathResource("db/migration/V4__outbound_email_kind.sql").getInputStream()) {
            String script = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            backfill = Arrays.stream(script.split(";"))
                    .map(statement -> statement.lines().filter(line -> !line.trim().startsWith("--"))
                            .collect(Collectors.joining("\n")).trim())
                    .filter(statement -> statement.startsWith("UPDATE"))
                    .findFirst().orElseThrow();
        }
        jdbc.update(backfill);

        Map<String, String> actual = new LinkedHashMap<>();
        jdbc.query("SELECT subject, kind FROM outbound_emails WHERE to_address = ? ORDER BY id",
                rs -> {
                    actual.put(rs.getString(1), rs.getString(2));
                }, marker);
        assertThat(actual).containsExactlyEntriesOf(expected);
        jdbc.update("DELETE FROM outbound_emails WHERE to_address = ?", marker);
    }
}
