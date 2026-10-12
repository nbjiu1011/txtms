package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

class VariableIntegrationTest extends IntegrationTestBase {

    private int revision(Login login, long projectId) throws Exception {
        return getJson(login, "/api/projects/" + projectId).path("variablesRevision").asInt();
    }

    private static List<String> keys(JsonNode list) {
        List<String> keys = new ArrayList<>();
        list.forEach(v -> keys.add(v.path("key").asString()));
        return keys;
    }

    @Test
    void membersRegisterAndAdminsManageVariables() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login rev = login(t.reviewer());
        Login admin = login(t.admin());
        Login moon = login(MOON_REQUESTER);
        String base = "/api/projects/" + t.projectId() + "/variables";

        assertThat(keys(getJson(req, base))).containsExactly("customer_name");
        int rev0 = revision(admin, t.projectId());

        // any member registers; values are checked by type
        JsonNode points = expect(201, rev, post(base), Map.of("key", "points", "description", "적립 포인트",
                "type", "NUMBER", "value", "5000"));
        assertThat(points.path("active").asBoolean()).isTrue();
        assertThat(points.path("inUse").asBoolean()).isFalse();
        assertThat(points.path("createdBy").asLong()).isEqualTo(userId(t.reviewer()));
        assertThat(revision(admin, t.projectId())).isEqualTo(rev0 + 1);

        assertThat(expect(400, req, post(base), Map.of("key", "Points", "type", "TEXT", "value", ""))
                .path("message").asString()).isEqualTo("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
        assertThat(expect(409, req, post(base), Map.of("key", "points", "type", "TEXT", "value", ""))
                .path("message").asString()).isEqualTo("이미 등록된 변수입니다. 기존 변수를 사용하세요");
        assertThat(expect(400, req, post(base), Map.of("key", "amount", "type", "NUMBER", "value", "1,000"))
                .path("message").asString()).isEqualTo("정수 또는 소수를 입력하세요");
        assertThat(expect(400, req, post(base), Map.of("key", "day", "type", "DATE", "value", "2026-02-30"))
                .path("message").asString()).isEqualTo("유효한 YYYY-MM-DD 날짜를 입력하세요");
        assertThat(expect(400, req, post(base), Map.of("key", "url", "type", "LINK", "value", "ftp://a.kr"))
                .path("message").asString()).isEqualTo("HTTP/HTTPS 링크를 입력하세요");
        expect(201, req, post(base), Map.of("key", "event_url", "type", "LINK", "value", "https://a.kr/e"));
        expect(201, req, post(base), Map.of("key", "open_day", "type", "DATE", "value", "2026-11-01"));
        expect(404, moon, post(base), Map.of("key", "x", "type", "TEXT", "value", ""));
        expect(404, moon, get(base), null);

        // a draft uses #{points} → in use
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "FREEFORM"))
                .path("id").asString();
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload",
                Map.of("text", "#{points} 포인트 적립")));
        JsonNode listed = getJson(req, base + "?q=포인트");
        assertThat(keys(listed)).containsExactly("points");
        assertThat(listed.get(0).path("inUse").asBoolean()).isTrue();
        assertThat(keys(getJson(req, base + "?q=URL"))).containsExactly("event_url");

        long pointsId = points.path("id").asLong();
        // only customer admins edit, delete and read logs
        assertThat(expect(403, req, patch("/api/variables/" + pointsId), Map.of("value", "1"))
                .path("message").asString()).isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(403, req, delete("/api/variables/" + pointsId), null);
        expect(403, req, get("/api/variables/" + pointsId + "/logs"), null);
        expect(404, moon, patch("/api/variables/" + pointsId), Map.of("value", "1"));
        expect(404, login(KANG_ADMIN), patch("/api/variables/" + pointsId), Map.of("value", "1"));

        assertThat(expect(400, admin, patch("/api/variables/" + pointsId), Map.of("key", "bonus"))
                .path("message").asString()).isEqualTo("사용 중인 변수는 키를 변경할 수 없습니다");
        assertThat(expect(400, admin, delete("/api/variables/" + pointsId), null).path("message").asString())
                .isEqualTo("사용 중인 변수는 삭제할 수 없습니다");
        expect(400, admin, patch("/api/variables/" + pointsId), Map.of("value", "abc"));
        JsonNode changed = expect(200, admin, patch("/api/variables/" + pointsId), Map.of("value", "7000.5",
                "description", "적립 예정 포인트"));
        assertThat(changed.path("value").asString()).isEqualTo("7000.5");
        assertThat(changed.path("inUse").asBoolean()).isTrue();

        // deactivating an in-use variable is allowed; submit then reports it
        expect(200, admin, patch("/api/variables/" + pointsId), Map.of("active", false));
        assertThat(keys(getJson(req, base + "?active=true"))).doesNotContain("points");
        assertThat(keys(getJson(req, base + "?active=false"))).containsExactly("points");
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "t", "hopeDueDate", "2026-12-01",
                "purpose", "p", "target", "t", "background", "b"));
        long rv = getJson(req, "/api/requests/" + id).path("rowVersion").asLong();
        assertThat(expect(400, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rv))
                .path("details").get(0).asString()).isEqualTo("C1: 등록되지 않았거나 비활성 변수 points");

        List<String> actions = new ArrayList<>();
        getJson(admin, "/api/variables/" + pointsId + "/logs").forEach(l -> actions.add(l.path("action").asString()));
        assertThat(actions).containsExactly("등록", "변경", "사용 중지");
        JsonNode last = getJson(admin, "/api/variables/" + pointsId + "/logs").get(2);
        assertThat(last.path("before").path("active").asBoolean()).isTrue();
        assertThat(last.path("after").path("active").asBoolean()).isFalse();
        assertThat(last.path("actorId").asLong()).isEqualTo(userId(t.admin()));

        // key change and delete of an unused variable; deleted keys stay reserved
        JsonNode openDay = getJson(req, base + "?q=open_day").get(0);
        expect(200, admin, patch("/api/variables/" + openDay.path("id").asLong()), Map.of("key", "start_day"));
        expect(204, admin, delete("/api/variables/" + openDay.path("id").asLong()), null);
        assertThat(keys(getJson(req, base))).doesNotContain("start_day");
        expect(409, req, post(base), Map.of("key", "start_day", "type", "TEXT", "value", ""));
        expect(404, admin, patch("/api/variables/" + openDay.path("id").asLong()), Map.of("value", "x"));
        List<String> deletedLog = new ArrayList<>();
        getJson(admin, "/api/variables/" + openDay.path("id").asLong() + "/logs")
                .forEach(l -> deletedLog.add(l.path("action").asString()));
        assertThat(deletedLog).containsExactly("등록", "변경", "삭제 (이력 보존)");

        assertThat(revision(admin, t.projectId())).isEqualTo(rev0 + 7);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE customer_id = ? AND action IN "
                + "('변수 변경', '변수 삭제')", Integer.class, t.customerId())).isEqualTo(4);
    }

    @Test
    void adminsListDeletedVariablesAndReadTheProjectLog() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login admin = login(t.admin());
        String base = "/api/projects/" + t.projectId() + "/variables";
        String logUrl = "/api/projects/" + t.projectId() + "/variable-logs";

        long alpha = expect(201, req, post(base), Map.of("key", "alpha", "type", "TEXT", "value", "1"))
                .path("id").asLong();
        long beta = expect(201, admin, post(base), Map.of("key", "beta", "type", "TEXT", "value", "2"))
                .path("id").asLong();
        expect(200, admin, patch("/api/variables/" + alpha), Map.of("value", "3"));
        expect(204, admin, delete("/api/variables/" + beta), null);

        // includeDeleted: admins only, deleted variables marked
        assertThat(keys(getJson(admin, base))).containsExactly("customer_name", "alpha");
        assertThat(keys(getJson(req, base + "?includeDeleted=false"))).containsExactly("customer_name", "alpha");
        getJson(req, base).forEach(v -> assertThat(v.path("deleted").asBoolean()).isFalse());
        JsonNode all = getJson(admin, base + "?includeDeleted=true");
        assertThat(keys(all)).containsExactly("customer_name", "alpha", "beta");
        List<Boolean> deleted = new ArrayList<>();
        all.forEach(v -> deleted.add(v.path("deleted").asBoolean()));
        assertThat(deleted).containsExactly(false, false, true);
        assertThat(all.get(2).path("active").asBoolean()).isFalse();
        assertThat(keys(getJson(admin, base + "?includeDeleted=true&q=bet"))).containsExactly("beta");
        assertThat(keys(getJson(admin, base + "?includeDeleted=true&active=true")))
                .containsExactly("customer_name", "alpha");
        assertThat(expect(403, req, get(base + "?includeDeleted=true"), null).path("message").asString())
                .isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(403, lead, get(base + "?includeDeleted=true"), null);
        expect(404, login(KANG_ADMIN), get(base + "?includeDeleted=true"), null);
        expect(404, login(MOON_REQUESTER), get(base + "?includeDeleted=true"), null);
        expect(404, login(JUNG_OPERATOR), get(base + "?includeDeleted=true"), null);

        // 변수 관리 list: the includeDeleted rows, paged, same filters and access
        JsonNode managed = getJson(admin, base + "/manage");
        assertThat(managed.path("content").toString()).isEqualTo(all.toString());
        assertThat(managed.path("page").path("totalElements").asLong()).isEqualTo(3);
        assertThat(managed.path("page").path("size").asInt()).isEqualTo(20);
        JsonNode lastPage = getJson(admin, base + "/manage?page=1&size=2");
        assertThat(keys(lastPage.path("content"))).containsExactly("beta");
        assertThat(lastPage.path("page").path("totalPages").asInt()).isEqualTo(2);
        assertThat(keys(getJson(admin, base + "/manage?q=bet").path("content"))).containsExactly("beta");
        assertThat(keys(getJson(admin, base + "/manage?active=true").path("content")))
                .containsExactly("customer_name", "alpha");
        assertThat(expect(403, req, get(base + "/manage"), null).path("message").asString())
                .isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(404, login(KANG_ADMIN), get(base + "/manage"), null);
        expect(404, login(JUNG_OPERATOR), get(base + "/manage"), null);

        // project change log: every variable (deleted included), newest first, with the actor's name
        JsonNode log = getJson(admin, logUrl);
        List<String> entries = new ArrayList<>();
        log.forEach(l -> entries.add(l.path("variableId").asLong() + " " + l.path("action").asString() + " "
                + l.path("actorName").asString()));
        assertThat(entries).containsExactly(beta + " 삭제 (이력 보존) 사용자 admin", alpha + " 변경 사용자 admin",
                beta + " 등록 사용자 admin", alpha + " 등록 사용자 req");
        JsonNode change = log.get(1);
        assertThat(change.path("actorId").asLong()).isEqualTo(userId(t.admin()));
        assertThat(change.path("before").path("value").asString()).isEqualTo("1");
        assertThat(change.path("after").path("value").asString()).isEqualTo("3");
        assertThat(log.get(3).path("before").isNull()).isTrue();
        assertThat(log.get(3).path("at").asString()).isNotEmpty();

        assertThat(expect(403, req, get(logUrl), null).path("message").asString())
                .isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(403, lead, get(logUrl), null);
        expect(404, login(KANG_ADMIN), get(logUrl), null);
        expect(404, login(MOON_REQUESTER), get(logUrl), null);
        expect(404, login(JUNG_OPERATOR), get(logUrl), null);
        expect(404, admin, get("/api/projects/999999999/variable-logs"), null);

        // at most 500 entries: older entries beyond the cap are left out
        LocalDateTime past = LocalDateTime.of(2020, 6, 1, 0, 0);
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < 510; i++) {
            rows.add(new Object[] {alpha, past.plusMinutes(i), userId(t.admin()), "변경"});
        }
        jdbc.batchUpdate("INSERT INTO variable_logs (variable_id, at, actor_id, action, before_json, after_json) "
                + "VALUES (?, ?, ?, ?, NULL, NULL)", rows);
        JsonNode capped = getJson(admin, logUrl);
        assertThat(capped).hasSize(500);
        assertThat(capped.get(0).path("action").asString()).isEqualTo("삭제 (이력 보존)");
        assertThat(capped.get(499).path("at").asString()).startsWith("2020-0");
    }
}
