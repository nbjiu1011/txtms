package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * {@code GET /api/performance} on a crafted dataset (requests written directly with fixed times): KST period
 * boundaries, exclusions, people rows, the workload of every permitted project, and access.
 */
class PerformanceIntegrationTest extends IntegrationTestBase {

    private static LocalDateTime utc(String instant) {
        return instant == null ? null : LocalDateTime.ofInstant(Instant.parse(instant), ZoneOffset.UTC);
    }

    private void request(String id, long projectId, long requester, String status, String submittedAt,
            String completedAt, Long primary, List<Long> reviewers, int contents, boolean cancelled, boolean demo) {
        LocalDateTime created = utc("2026-08-01T00:00:00Z");
        jdbc.update("INSERT INTO requests (id, project_id, content_type, title, status, round, requested_by, created_at, "
                + "submitted_at, completed_at, primary_reviewer_id, cancelled, demo, updated_at) VALUES (?, ?, 'SMS', ?, ?, "
                + "1, ?, ?, ?, ?, ?, ?, ?, ?)", id, projectId, "실적 " + id, status, requester, created,
                utc(submittedAt), utc(completedAt), primary, cancelled, demo, created);
        for (int i = 0; i < reviewers.size(); i++) {
            jdbc.update("INSERT INTO request_reviewers (request_id, sort_order, user_id) VALUES (?, ?, ?)", id, i,
                    reviewers.get(i));
        }
        for (int i = 1; i <= contents; i++) {
            jdbc.update("INSERT INTO contents (request_id, content_key, title, payload, sort_order, created_at, "
                    + "updated_at) VALUES (?, ?, '', '{}', ?, ?, ?)", id, "C" + i, i, created, created);
        }
        // a deleted content never counts
        jdbc.update("INSERT INTO contents (request_id, content_key, title, payload, sort_order, deleted, created_at, "
                + "updated_at) VALUES (?, 'C99', '', '{}', 99, 1, ?, ?)", id, created, created);
    }

    private void history(String id, long actor, String action, String at) {
        jdbc.update("INSERT INTO request_history (request_id, at, actor_id, action, round) VALUES (?, ?, ?, ?, 1)", id,
                utc(at), actor, action);
    }

    private static String row(JsonNode people, long userId) {
        for (JsonNode p : people) {
            if (p.path("userId").asLong() == userId) {
                return p.path("completedAsPrimary").asInt() + "/" + p.path("coReviewed").asInt() + "/"
                        + p.path("assignmentsManaged").asInt() + "/" + p.path("active").asInt();
            }
        }
        return null;
    }

    private static int workloadActive(JsonNode workload, long userId) {
        for (JsonNode w : workload) {
            if (w.path("userId").asLong() == userId) {
                return w.path("active").asInt();
            }
        }
        return -1;
    }

    @Test
    void statisticsFollowThePlanningRules() throws Exception {
        Tenant t = newTenant();
        long req = userId(t.requester());
        long lead = userId(t.lead());
        long rev = userId(t.reviewer());
        String p = "PF" + t.customerId() + "-";
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO projects (customer_id, name, active, lead_user_id, variables_revision, created_at, "
                + "updated_at) VALUES (?, '실적 보조', 1, ?, 0, ?, ?)", t.customerId(), rev, now, now);
        long p2 = jdbc.queryForObject("SELECT id FROM projects WHERE customer_id = ? AND name = '실적 보조'", Long.class,
                t.customerId());
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'REVIEWER'), "
                + "(?, ?, 'REQUESTER')", p2, rev, p2, req);

        // period 2026-09-01..2026-09-30 KST = [2026-08-31T15:00Z, 2026-09-30T15:00Z)
        request(p + "A", t.projectId(), req, "REVIEW_COMPLETED", "2026-08-31T15:00:00Z", "2026-09-10T01:00:00Z", rev,
                List.of(rev, lead), 2, false, false);
        history(p + "A", lead, "검수자 배정", "2026-09-02T01:00:00Z");
        history(p + "A", rev, "검수 완료", "2026-09-10T01:00:00Z");
        request(p + "B", t.projectId(), req, "IN_REVIEW", "2026-09-30T14:59:59Z", null, rev, List.of(rev), 1, false,
                false);
        history(p + "B", lead, "검수자 배정", "2026-09-30T14:59:59Z");
        request(p + "C", t.projectId(), req, "WAITING", "2026-09-30T15:00:00Z", null, null, List.of(), 1, false, false);
        request(p + "D", t.projectId(), req, "DRAFT", "2026-09-05T01:00:00Z", null, null, List.of(), 1, true, false);
        request(p + "E", t.projectId(), req, "WAITING", "2026-09-05T01:00:00Z", null, null, List.of(), 1, false, true);
        request(p + "F", t.projectId(), req, "REVIEW_COMPLETED", "2026-08-20T01:00:00Z", "2026-09-30T14:00:00Z", lead,
                List.of(lead), 3, false, false);
        history(p + "F", lead, "검수 완료", "2026-09-30T14:00:00Z");
        history(p + "F", lead, "검수자 배정", "2026-08-21T01:00:00Z"); // before the period
        request(p + "G", t.projectId(), req, "CONFIRMING", "2026-09-15T01:00:00Z", null, rev, List.of(rev), 1, false,
                false);
        request(p + "H", p2, req, "IN_REVIEW", "2026-09-10T01:00:00Z", null, rev, List.of(rev), 1, false, false);

        String q = "/api/performance?customerId=" + t.customerId() + "&from=2026-09-01&to=2026-09-30";
        Login leadLogin = login(t.lead());
        JsonNode mine = getJson(leadLogin, q);
        assertThat(mine.path("projectIds").toString()).isEqualTo("[" + t.projectId() + "]");
        assertThat(mine.path("received").asInt()).isEqualTo(3);           // A B G
        assertThat(mine.path("receivedContents").asInt()).isEqualTo(4);
        assertThat(mine.path("receivedCompleted").asInt()).isEqualTo(1);  // A
        assertThat(mine.path("completionRate").asDouble()).isEqualTo(33.3);
        assertThat(mine.path("completedInPeriod").asInt()).isEqualTo(2);  // A F
        assertThat(mine.path("completedContents").asInt()).isEqualTo(5);
        assertThat(mine.path("inProgress").asInt()).isEqualTo(3);         // B C G
        assertThat(row(mine.path("people"), lead)).isEqualTo("1/2/2/0");
        assertThat(row(mine.path("people"), rev)).isEqualTo("1/1/0/2");
        assertThat(workloadActive(mine.path("workload"), rev)).isEqualTo(2);
        assertThat(mine.path("fromDate").asString()).isEqualTo("2026-09-01");

        // the admin's "all" covers every project of the customer, workload included
        Login admin = login(t.admin());
        JsonNode all = getJson(admin, q);
        assertThat(all.path("projectIds")).hasSize(2);
        assertThat(all.path("received").asInt()).isEqualTo(4);
        assertThat(all.path("completionRate").asDouble()).isEqualTo(25.0);
        assertThat(all.path("inProgress").asInt()).isEqualTo(4);
        assertThat(workloadActive(all.path("workload"), rev)).isEqualTo(3);
        JsonNode one = getJson(admin, q + "&projectId=" + p2 + "&userId=" + rev);
        assertThat(one.path("received").asInt()).isEqualTo(1);
        assertThat(one.path("people")).hasSize(1);
        assertThat(row(one.path("people"), rev)).isEqualTo("0/0/0/1");

        // the reviewer leads only the second project
        Login revLogin = login(t.reviewer());
        assertThat(getJson(revLogin, q).path("projectIds").toString()).isEqualTo("[" + p2 + "]");
        expect(403, revLogin, get(q + "&projectId=" + t.projectId()), null);

        // zero denominator, bad period, access
        JsonNode empty = getJson(admin, "/api/performance?customerId=" + t.customerId()
                + "&from=2026-01-01&to=2026-01-31");
        assertThat(empty.path("completionRate").isNull()).isTrue();
        assertThat(empty.path("received").asInt()).isZero();
        expect(400, admin, get("/api/performance?customerId=" + t.customerId() + "&from=2026-10-02&to=2026-10-01"),
                null);
        expect(403, login(t.requester()), get(q), null);
        expect(404, login(KANG_ADMIN), get(q), null);
        expect(404, admin, get(q + "&projectId=" + projectId("카드 혜택 알림")), null);
        // default period: the last 30 days up to today
        JsonNode defaults = getJson(admin, "/api/performance?customerId=" + t.customerId());
        assertThat(java.time.LocalDate.parse(defaults.path("fromDate").asString()).plusDays(29))
                .isEqualTo(java.time.LocalDate.parse(defaults.path("toDate").asString()));
    }
}
