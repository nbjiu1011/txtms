package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** Contract §14.2: lock grant version, the lock state list, and {@code RequestSummary.approvable}. */
class LockStateIntegrationTest extends IntegrationTestBase {

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private String inReview(Tenant t, Login req, Login lead, long reviewer) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("id").asString();
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "잠금 확인", "hopeDueDate", "2026-12-20",
                "purpose", "안내", "target", "전체 회원", "background", "정기 발송"));
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of("sender", "1588-0000",
                "body", "포인트가 적립되었습니다", "customerCenter", false, "optOut", false)));
        expect(201, req, post("/api/requests/" + id + "/contents"), Map.of("title", "두 번째"));
        expect(200, req, put("/api/requests/" + id + "/contents/C2"), Map.of("payload", Map.of("sender", "1588-0000",
                "body", "두 번째 안내입니다", "customerCenter", false, "optOut", false)));
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", List.of(reviewer));
        body.put("dueDate", "2026-12-15");
        body.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, post("/api/requests/" + id + "/assignment"), body);
        return id;
    }

    @Test
    void lockGrantAndLockStates() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        long reviewer = userId(t.reviewer());
        String id = inReview(t, req, lead, reviewer);

        JsonNode grant = expect(200, rev, post("/api/requests/" + id + "/contents/C1/lock"), null);
        assertThat(grant.path("userId").asLong()).isEqualTo(reviewer);
        assertThat(grant.path("version").asInt()).isEqualTo(1);

        JsonNode states = getJson(req, "/api/requests/" + id + "/locks");
        assertThat(states).hasSize(2);
        assertThat(states.get(0).path("contentKey").asString()).isEqualTo("C1");
        assertThat(states.get(0).path("userId").asLong()).isEqualTo(reviewer);
        assertThat(states.get(0).path("expiresAt").isString()).isTrue();
        assertThat(states.get(0).path("version").asInt()).isEqualTo(1);
        assertThat(states.get(1).path("contentKey").asString()).isEqualTo("C2");
        assertThat(states.get(1).path("userId").isNull()).isTrue();
        assertThat(states.get(1).path("lockedAt").isNull()).isTrue();

        // an expired lock is reported as free
        jdbc.update("UPDATE contents SET lock_at = ? WHERE request_id = ? AND content_key = 'C1'",
                LocalDateTime.now(ZoneOffset.UTC).minusMinutes(31), id);
        assertThat(getJson(lead, "/api/requests/" + id + "/locks").get(0).path("userId").isNull()).isTrue();
        expect(404, login(KIM_REQUESTER), get("/api/requests/" + id + "/locks"), null);
        expect(404, login(JUNG_OPERATOR), get("/api/requests/" + id + "/locks"), null);
    }

    @Test
    void approvableMarksTheEligibleApproversRequests() throws Exception {
        Tenant t = newTenant();
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        String email = "appr" + t.requester().substring(t.requester().indexOf('@'));
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class,
                KIM_REQUESTER);
        jdbc.update("INSERT INTO users (customer_id, email, name, dept, active, pending, operator, demo, avatar_color, "
                + "password_hash, created_at, updated_at) VALUES (?, ?, '승인자', '테스트팀', 1, 0, 0, 0, '#123456', ?, ?, ?)",
                t.customerId(), email, hash, now, now);
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'APPROVER')",
                t.projectId(), userId(email));
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String id = inReview(t, req, lead, userId(t.reviewer()));
        String list = "/api/requests?projectId=" + t.projectId();
        assertThat(getJson(login(email), list).path("content").get(0).path("approvable").asBoolean()).isFalse();
        expect(200, rev, post("/api/requests/" + id + "/complete"), Map.of("rowVersion", rowVersion(rev, id)));

        Login approver = login(email);
        assertThat(getJson(approver, list).path("content").get(0).path("approvable").asBoolean()).isTrue();
        assertThat(getJson(approver, "/api/requests/" + id).path("approvable").asBoolean()).isTrue();
        assertThat(getJson(req, list).path("content").get(0).path("approvable").asBoolean()).isFalse();
        assertThat(getJson(rev, "/api/requests/" + id).path("approvable").asBoolean()).isFalse();
    }
}
