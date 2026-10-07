package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.txtms.domain.request.service.ReminderService;
import com.txtms.global.audit.AuditRetentionService;
import com.txtms.global.common.Kst;
import com.txtms.support.IntegrationTestBase;

/**
 * Re-notification scheduler (run directly with the adjustable clock) and the access-log retention job. The
 * reminder state of other tests' requests is irrelevant: assertions look at this tenant's requests only.
 */
class ReminderIntegrationTest extends IntegrationTestBase {

    private static final Duration DAY = Duration.ofHours(24);

    @Autowired
    ReminderService reminders;

    @Autowired
    AuditRetentionService retention;

    private String submitted(Login req, Tenant t, String title) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("id").asString();
        expect(200, req, patch("/api/requests/" + id), Map.of("title", title, "hopeDueDate", "2026-12-20",
                "purpose", "안내", "target", "전체 회원", "background", "정기 발송"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("sender", "1588-0000",
                "body", "포인트가 적립되었습니다", "customerCenter", false, "optOut", false)));
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
        return id;
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private List<Map<String, Object>> reminderRows(String requestId, long userId) {
        return jdbc.queryForList("SELECT text, kind, source_notification_id, actor_id FROM notifications "
                + "WHERE request_id = ? AND user_id = ? AND renotify = TRUE ORDER BY id", requestId, userId);
    }

    private List<String> texts(String requestId, long userId) {
        return reminderRows(requestId, userId).stream().map(r -> (String) r.get("text")).toList();
    }

    private String current;

    /** Advances the clock and runs the scheduler for this test's request only (demo data stays untouched). */
    private void run(Duration advance) {
        clock.advance(advance);
        reminders.run(current::equals);
    }

    @Test
    void unfinishedWorkIsRenotifiedEvery24HoursAtMostThreeTimes() throws Exception {
        Tenant t = newTenant();
        jdbc.update("UPDATE customers SET notify_channel = 'IN_APP_EMAIL' WHERE id = ?", t.customerId());
        long lead = userId(t.lead());
        long reviewer = userId(t.reviewer());
        long requester = userId(t.requester());
        String id = submitted(login(t.requester()), t, "적립 안내");
        current = id;

        run(Duration.ZERO);
        assertThat(texts(id, lead)).isEmpty();
        run(DAY.minusMinutes(1));
        assertThat(texts(id, lead)).isEmpty();
        run(Duration.ofMinutes(1));
        assertThat(texts(id, lead)).containsExactly("미처리 재통지 1/3: 적립 안내");
        Map<String, Object> first = reminderRows(id, lead).getFirst();
        assertThat(first.get("kind")).isEqualTo("ASSIGN");
        assertThat(first.get("actor_id")).isNull();
        assertThat(((Number) first.get("source_notification_id")).longValue()).isEqualTo(jdbc.queryForObject(
                "SELECT id FROM notifications WHERE request_id = ? AND user_id = ? AND renotify = FALSE", Long.class,
                id, lead));
        run(Duration.ZERO); // same run window: nothing new
        run(DAY);
        run(DAY);
        run(DAY);
        run(DAY);
        assertThat(texts(id, lead)).containsExactly("미처리 재통지 1/3: 적립 안내", "미처리 재통지 2/3: 적립 안내",
                "미처리 재통지 3/3: 적립 안내");
        assertThat(texts(id, requester)).isEmpty(); // the requester has nothing to do while waiting
        // not urgent: no mail even with the email channel
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM outbound_emails WHERE to_address = ?", Integer.class,
                t.lead())).isZero();
        // the API shows them as re-notifications
        clock.reset();
        Login leadLogin = login(t.lead());
        assertThat(getJson(leadLogin, "/api/notifications").path("items").get(0).path("renotify").asBoolean())
                .isTrue();

        // ---- urgent: due tomorrow (KST); the assigned reviewer is pending, the lead no longer is
        LocalDate tomorrow = Kst.dateOf(clock.instant()).plusDays(1);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", List.of(reviewer));
        body.put("dueDate", tomorrow.toString());
        body.put("rowVersion", rowVersion(leadLogin, id));
        expect(200, leadLogin, post("/api/requests/" + id + "/assignment"), body);
        run(DAY);
        run(DAY);
        assertThat(texts(id, reviewer)).containsExactly("납기 임박 재통지 1/3: 적립 안내", "납기 임박 재통지 2/3: 적립 안내");
        assertThat(reminderRows(id, reviewer).getFirst().get("kind")).isEqualTo("DUE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM outbound_emails WHERE to_address = ?", Integer.class,
                t.reviewer())).isZero();
        run(DAY); // third urgent reminder (overdue by now) → mailed too
        assertThat(texts(id, reviewer)).hasSize(3).last().isEqualTo("납기 임박 재통지 3/3: 적립 안내");
        assertThat(jdbc.queryForObject("SELECT subject FROM outbound_emails WHERE to_address = ?", String.class,
                t.reviewer())).isEqualTo("납기 임박 재통지 3/3: 적립 안내");
        assertThat(texts(id, lead)).hasSize(3); // nothing more for the lead

        // ---- a due date change starts the count over (the schedule change clears the state)
        Login leadAgain = login(t.lead());
        expect(200, leadAgain, patch("/api/requests/" + id + "/schedule"), Map.of("dueDate",
                Kst.dateOf(clock.instant()).plusDays(2).toString(), "reason", "일정 조정", "rowVersion",
                rowVersion(leadAgain, id)));
        run(Duration.ZERO);
        assertThat(texts(id, reviewer)).hasSize(3);
        run(DAY);
        assertThat(texts(id, reviewer)).hasSize(4).last().isEqualTo("납기 임박 재통지 1/3: 적립 안내");
        assertThat(reminderRows(id, reviewer).getLast().get("source_notification_id")).isNotNull();

        // ---- finished work stops the reminders: the reviewer completes
        clock.reset();
        Login rev = login(t.reviewer());
        expect(200, rev, post("/api/requests/" + id + "/complete"), Map.of("rowVersion", rowVersion(rev, id)));
        run(Duration.ofDays(10));
        assertThat(texts(id, reviewer)).hasSize(4);
    }

    @Test
    void accessLogRetentionDeletesOnlyOldAccessRecords() {
        LocalDateTime old = LocalDateTime.ofInstant(Instant.now().minus(Duration.ofDays(1096)), ZoneOffset.UTC);
        LocalDateTime recent = LocalDateTime.ofInstant(Instant.now().minus(Duration.ofDays(1094)), ZoneOffset.UTC);
        String marker = "retention-" + System.nanoTime();
        jdbc.update("INSERT INTO audit_logs (at, action, target) VALUES (?, '파일 다운로드', ?), (?, '완료본 반출', ?), "
                + "(?, '첨부 반출', ?), (?, '사용자 초대', ?)", old, marker, recent, marker, old, marker, old, marker);
        retention.purgeExpired();
        assertThat(jdbc.queryForList("SELECT action FROM audit_logs WHERE target = ? ORDER BY id", String.class,
                marker)).containsExactly("완료본 반출", "사용자 초대");
    }
}
