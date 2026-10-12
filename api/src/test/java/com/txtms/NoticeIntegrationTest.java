package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** Notice management by the customer admin and notice visibility across customers and projects. */
class NoticeIntegrationTest extends IntegrationTestBase {

    private List<String> titles(Login login, long customerId) throws Exception {
        List<String> out = new ArrayList<>();
        getJson(login, "/api/notices?customerId=" + customerId + "&size=100").path("content")
                .forEach(n -> out.add(n.path("title").asString()));
        return out;
    }

    private String outsider(Tenant t) {
        String email = "outsider" + t.requester().substring(t.requester().indexOf('@'));
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class,
                KIM_REQUESTER);
        jdbc.update("INSERT INTO users (customer_id, email, name, dept, active, pending, operator, demo, avatar_color, "
                + "password_hash, created_at, updated_at) VALUES (?, ?, '외부인', '테스트팀', 1, 0, 0, 0, '#123456', ?, ?, ?)",
                t.customerId(), email, hash, now, now);
        return email;
    }

    private int audits(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    @Test
    void adminPostsEditsAndWithdrawsNoticesWithFullSnapshots() throws Exception {
        Tenant t = newTenant();
        Tenant other = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        Login stranger = login(outsider(t));
        Login otherAdmin = login(other.admin());
        Login otherReq = login(other.requester());
        String base = "/api/customers/" + t.customerId() + "/notices";

        // ---- validation and access
        assertThat(expect(400, admin, post(base), Map.of("title", "점검", "body", "본문")).path("message").asString())
                .isEqualTo("공지 범위를 선택하세요");
        assertThat(expect(400, admin, post(base), Map.of("scope", "PROJECT", "title", "점검", "body", "본문"))
                .path("message").asString()).isEqualTo("프로젝트를 선택하세요");
        expect(404, admin, post(base), Map.of("scope", "PROJECT", "projectId", other.projectId(), "title", "점검",
                "body", "본문"));
        assertThat(expect(400, admin, post(base), Map.of("scope", "CUSTOMER", "title", " ", "body", "본문"))
                .path("message").asString()).isEqualTo("제목을(를) 입력하세요");
        assertThat(expect(400, admin, post(base), Map.of("scope", "CUSTOMER", "title", "x".repeat(201), "body",
                "본문")).path("message").asString()).isEqualTo("제목은 최대 200자입니다");
        assertThat(expect(400, admin, post(base), Map.of("scope", "CUSTOMER", "title", "점검", "body", ""))
                .path("message").asString()).isEqualTo("내용을(를) 입력하세요");
        assertThat(expect(403, req, post(base), Map.of("scope", "CUSTOMER", "title", "점검", "body", "본문"))
                .path("message").asString()).isEqualTo("고객사 관리자 권한이 필요합니다");
        expect(404, otherAdmin, post(base), Map.of("scope", "CUSTOMER", "title", "점검", "body", "본문"));
        expect(403, req, get(base + "/manage"), null);

        // ---- post
        JsonNode wide = expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "projectId", t.projectId(),
                "title", "정기 점검 안내", "body", "토요일 02시"));
        assertThat(wide.path("projectId").isNull()).isTrue();
        assertThat(wide.path("authorId").asLong()).isEqualTo(admin.userId());
        JsonNode project = expect(201, admin, post(base), Map.of("scope", "PROJECT", "projectId", t.projectId(),
                "title", "프로젝트 일정", "body", "연휴 일정"));
        long projectNotice = project.path("id").asLong();
        assertThat(audits("공지 게시", t.customerId())).isEqualTo(2);

        // ---- visibility: members see both, a customer user outside the project only the customer-wide one,
        // other customers nothing
        assertThat(titles(req, t.customerId())).containsExactly("프로젝트 일정", "정기 점검 안내");
        assertThat(titles(stranger, t.customerId())).containsExactly("정기 점검 안내");
        assertThat(titles(admin, t.customerId())).containsExactly("프로젝트 일정", "정기 점검 안내");
        expect(404, otherReq, get("/api/notices?customerId=" + t.customerId()), null);
        assertThat(titles(otherReq, other.customerId())).isEmpty();
        assertThat(getJson(req, "/api/projects/" + t.projectId() + "/dashboard").path("notices")).hasSize(2);

        // ---- edit: full previous snapshot and the actor
        expect(403, req, patch("/api/notices/" + projectNotice), Map.of("title", "x"));
        expect(404, otherAdmin, patch("/api/notices/" + projectNotice), Map.of("title", "x"));
        JsonNode edited = expect(200, admin, patch("/api/notices/" + projectNotice), Map.of("scope", "CUSTOMER",
                "title", "전체 일정", "body", "연휴 일정 변경"));
        assertThat(edited.path("edited").asBoolean()).isTrue();
        assertThat(edited.path("scope").asString()).isEqualTo("CUSTOMER");
        assertThat(edited.path("projectId").isNull()).isTrue();
        JsonNode log = edited.path("logs").get(0);
        assertThat(log.path("action").asString()).isEqualTo("수정");
        assertThat(log.path("actorId").asLong()).isEqualTo(admin.userId());
        assertThat(log.path("previousScope").asString()).isEqualTo("PROJECT");
        assertThat(log.path("previousProjectId").asLong()).isEqualTo(t.projectId());
        assertThat(log.path("previousTitle").asString()).isEqualTo("프로젝트 일정");
        assertThat(log.path("previousBody").asString()).isEqualTo("연휴 일정");
        assertThat(titles(stranger, t.customerId())).containsExactly("전체 일정", "정기 점검 안내");
        // keys left out keep their value; switching back to a project needs the project
        JsonNode back = expect(200, admin, patch("/api/notices/" + projectNotice), Map.of("scope", "PROJECT",
                "projectId", t.projectId()));
        assertThat(back.path("title").asString()).isEqualTo("전체 일정");
        assertThat(back.path("logs")).hasSize(2);
        assertThat(audits("공지 수정", t.customerId())).isEqualTo(2);

        // ---- withdraw
        JsonNode withdrawn = expect(200, admin, post("/api/notices/" + projectNotice + "/withdraw"), null);
        assertThat(withdrawn.path("withdrawn").asBoolean()).isTrue();
        assertThat(withdrawn.path("logs").get(2).path("action").asString()).isEqualTo("철회");
        assertThat(titles(req, t.customerId())).containsExactly("정기 점검 안내");
        JsonNode managePage = getJson(admin, base + "/manage");
        assertThat(managePage.path("page").path("totalElements").asLong()).isEqualTo(2);
        assertThat(managePage.path("page").path("size").asInt()).isEqualTo(20);
        JsonNode manage = managePage.path("content");
        assertThat(manage).hasSize(2);
        assertThat(manage.get(0).path("withdrawn").asBoolean()).isTrue();
        JsonNode older = getJson(admin, base + "/manage?page=1&size=1");
        assertThat(older.path("page").path("totalPages").asInt()).isEqualTo(2);
        assertThat(older.path("content").get(0).path("id").asLong()).isEqualTo(manage.get(1).path("id").asLong());
        JsonNode visible = getJson(req, "/api/notices?customerId=" + t.customerId());
        assertThat(visible.path("page").path("totalElements").asLong()).isEqualTo(1);
        assertThat(getJson(req, "/api/notices?customerId=" + t.customerId() + "&page=1").path("content")).isEmpty();
        assertThat(expect(409, admin, post("/api/notices/" + projectNotice + "/withdraw"), null).path("message")
                .asString()).isEqualTo("철회된 공지는 수정하거나 다시 철회할 수 없습니다");
        expect(409, admin, patch("/api/notices/" + projectNotice), Map.of("title", "부활"));
        assertThat(audits("공지 철회", t.customerId())).isEqualTo(1);
    }
}
