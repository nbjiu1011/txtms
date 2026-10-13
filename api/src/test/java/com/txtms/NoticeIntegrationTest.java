package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
    void adminPostsAndEditsNoticesWithFullSnapshots() throws Exception {
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

        JsonNode managePage = getJson(admin, base + "/manage");
        assertThat(managePage.path("page").path("totalElements").asLong()).isEqualTo(2);
        assertThat(managePage.path("page").path("size").asInt()).isEqualTo(20);
        JsonNode manage = managePage.path("content");
        JsonNode older = getJson(admin, base + "/manage?page=1&size=1");
        assertThat(older.path("page").path("totalPages").asInt()).isEqualTo(2);
        assertThat(older.path("content").get(0).path("id").asLong()).isEqualTo(manage.get(1).path("id").asLong());
        assertThat(getJson(req, "/api/notices?customerId=" + t.customerId() + "&page=1").path("content")).isEmpty();
    }

    @Test
    void adminPublishesUnpublishesDeletesAndRestoresNotices() throws Exception {
        Tenant t = newTenant();
        Tenant other = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        Login otherAdmin = login(other.admin());
        String base = "/api/customers/" + t.customerId() + "/notices";
        long live = expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "게시 공지", "body", "본문"))
                .path("id").asLong();

        // ---- saved unpublished: only the admins see it, not the users, the list order or the dashboard
        JsonNode draft = expect(201, admin, post(base), Map.of("scope", "PROJECT", "projectId", t.projectId(),
                "title", "미게시 공지", "body", "본문", "published", false));
        long hidden = draft.path("id").asLong();
        assertThat(draft.path("published").asBoolean()).isFalse();
        assertThat(draft.path("publishedAt").isNull()).isTrue();
        assertThat(draft.path("deleted").asBoolean()).isFalse();
        assertThat(audits("공지 등록(미게시)", t.customerId())).isEqualTo(1);
        assertThat(titles(req, t.customerId())).containsExactly("게시 공지");
        expect(404, req, get("/api/notices/" + hidden), null);
        assertThat(getJson(admin, "/api/notices/" + hidden).path("published").asBoolean()).isFalse();
        assertThat(getJson(admin, base + "/manage").path("content")).hasSize(2);
        // an unpublished notice can be edited; PATCH does not change the publish state
        JsonNode edited = expect(200, admin, patch("/api/notices/" + hidden), Map.of("title", "게시 예정 공지",
                "published", true));
        assertThat(edited.path("published").asBoolean()).isFalse();

        // ---- publish: shown from now on, most recently published first
        expect(403, req, post("/api/notices/" + hidden + "/publish"), null);
        expect(404, otherAdmin, post("/api/notices/" + hidden + "/publish"), null);
        JsonNode published = expect(200, admin, post("/api/notices/" + hidden + "/publish"), null);
        assertThat(published.path("published").asBoolean()).isTrue();
        assertThat(published.path("publishedAt").isNull()).isFalse();
        assertThat(published.path("logs").get(1).path("action").asString()).isEqualTo("게시");
        assertThat(titles(req, t.customerId())).containsExactly("게시 예정 공지", "게시 공지");
        assertThat(getJson(req, "/api/projects/" + t.projectId() + "/dashboard").path("notices").get(0)
                .path("title").asString()).isEqualTo("게시 예정 공지");
        assertThat(expect(409, admin, post("/api/notices/" + hidden + "/publish"), null).path("message")
                .asString()).isEqualTo("이미 게시된 공지입니다");

        // ---- unpublish: hidden again, publishedAt kept, can be published again
        JsonNode stopped = expect(200, admin, post("/api/notices/" + live + "/unpublish"), null);
        assertThat(stopped.path("published").asBoolean()).isFalse();
        assertThat(stopped.path("publishedAt").isNull()).isFalse();
        assertThat(stopped.path("logs").get(0).path("action").asString()).isEqualTo("게시 중지");
        assertThat(titles(req, t.customerId())).containsExactly("게시 예정 공지");
        assertThat(expect(409, admin, post("/api/notices/" + live + "/unpublish"), null).path("message")
                .asString()).isEqualTo("게시 중인 공지가 아닙니다");
        expect(200, admin, post("/api/notices/" + live + "/publish"), null);
        assertThat(titles(req, t.customerId())).containsExactly("게시 공지", "게시 예정 공지");

        // ---- delete: kept in the deleted list with its history, read-only until restored
        expect(403, req, delete("/api/notices/" + live), null);
        expect(404, otherAdmin, delete("/api/notices/" + live), null);
        expect(204, admin, delete("/api/notices/" + live), null);
        assertThat(titles(req, t.customerId())).containsExactly("게시 예정 공지");
        expect(404, req, get("/api/notices/" + live), null);
        JsonNode active = getJson(admin, base + "/manage").path("content");
        assertThat(active).hasSize(1);
        assertThat(active.get(0).path("id").asLong()).isEqualTo(hidden);
        JsonNode trash = getJson(admin, base + "/manage?deleted=true").path("content");
        assertThat(trash).hasSize(1);
        JsonNode deleted = trash.get(0);
        assertThat(deleted.path("deleted").asBoolean()).isTrue();
        assertThat(deleted.path("published").asBoolean()).isFalse();
        assertThat(deleted.path("logs").get(deleted.path("logs").size() - 1).path("action").asString())
                .isEqualTo("삭제");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notices WHERE id = ?", Integer.class, live)).isEqualTo(1);
        String gone = "삭제된 공지입니다. 복원한 뒤 다시 시도하세요";
        assertThat(expect(409, admin, patch("/api/notices/" + live), Map.of("title", "x")).path("message")
                .asString()).isEqualTo(gone);
        assertThat(expect(409, admin, post("/api/notices/" + live + "/publish"), null).path("message").asString())
                .isEqualTo(gone);
        expect(409, admin, post("/api/notices/" + live + "/unpublish"), null);
        assertThat(expect(409, admin, delete("/api/notices/" + live), null).path("message").asString())
                .isEqualTo("이미 삭제된 공지입니다");

        // ---- restore: back unpublished, so users still do not see it until it is published
        expect(403, req, post("/api/notices/" + live + "/restore"), null);
        JsonNode restored = expect(200, admin, post("/api/notices/" + live + "/restore"), null);
        assertThat(restored.path("deleted").asBoolean()).isFalse();
        assertThat(restored.path("published").asBoolean()).isFalse();
        assertThat(titles(req, t.customerId())).containsExactly("게시 예정 공지");
        assertThat(getJson(admin, base + "/manage?deleted=true").path("content")).isEmpty();
        assertThat(expect(409, admin, post("/api/notices/" + live + "/restore"), null).path("message").asString())
                .isEqualTo("삭제된 공지가 아닙니다");

        for (String action : List.of("공지 게시", "공지 게시 중지", "공지 삭제", "공지 복원")) {
            assertThat(audits(action, t.customerId())).as(action).isPositive();
        }
        assertThat(audits("공지 게시", t.customerId())).isEqualTo(3);
    }

    @Test
    void richBodiesAreSanitizedAndJudgedByTheirVisibleText() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        String base = "/api/customers/" + t.customerId() + "/notices";
        JsonNode rich = expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "서식 공지", "body",
                "<p><strong>점검</strong> 안내<script>alert(1)</script></p><p><a href=\"javascript:x()\">링크</a>"
                        + "<img src=\"x\" onerror=\"alert(1)\"></p><ol><li data-list=\"bullet\">항목</li></ol>"));
        String stored = rich.path("body").asString();
        assertThat(stored).startsWith("<p><strong>점검</strong> 안내</p>").contains("<li data-list=\"bullet\">항목</li>")
                .doesNotContain("script").doesNotContain("javascript").doesNotContain("onerror");
        assertThat(jdbc.queryForObject("SELECT body FROM notices WHERE id = ?", String.class,
                rich.path("id").asLong())).isEqualTo(stored);

        // the editor's empty document has no visible text
        assertThat(expect(400, admin, post(base), Map.of("scope", "CUSTOMER", "title", "빈 공지", "body",
                "<p><br></p>")).path("message").asString()).isEqualTo("내용을(를) 입력하세요");
        // an image alone is content; plain text (not HTML) is kept as written
        expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "이미지 공지", "body",
                "<p><img src=\"data:image/png;base64,iVBORw0KGgo=\"></p>"));
        assertThat(expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "일반 공지", "body",
                "1 < 2\n둘째 줄")).path("body").asString()).isEqualTo("1 < 2\n둘째 줄");
        // the visible text limit ignores the markup
        assertThat(expect(400, admin, post(base), Map.of("scope", "CUSTOMER", "title", "긴 공지", "body",
                "<p>" + "가".repeat(10_001) + "</p>")).path("message").asString()).isEqualTo("내용은 최대 10,000자입니다");
        expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "서식 많은 공지", "body",
                "<p><strong>" + "가".repeat(9_000) + "</strong></p>"));
    }

    @Test
    void detailFollowsTheListRulesAndAdminsAlsoReadHiddenNotices() throws Exception {
        Tenant t = newTenant();
        Tenant other = newTenant();
        Login admin = login(t.admin());
        Login req = login(t.requester());
        String base = "/api/customers/" + t.customerId() + "/notices";
        long wide = expect(201, admin, post(base), Map.of("scope", "CUSTOMER", "title", "전체 공지", "body",
                "<p>본문</p>")).path("id").asLong();
        long project = expect(201, admin, post(base), Map.of("scope", "PROJECT", "projectId", t.projectId(),
                "title", "프로젝트 공지", "body", "본문")).path("id").asLong();

        JsonNode detail = getJson(req, "/api/notices/" + wide);
        assertThat(detail.path("title").asString()).isEqualTo("전체 공지");
        assertThat(detail.path("body").asString()).isEqualTo("<p>본문</p>");
        assertThat(detail.path("logs").isArray()).isTrue();
        getJson(req, "/api/notices/" + project);

        // unpublished or deleted: gone for members, still readable (with the log) for the customer's admins
        expect(200, admin, post("/api/notices/" + wide + "/unpublish"), null);
        expect(404, req, get("/api/notices/" + wide), null);
        expect(204, admin, delete("/api/notices/" + wide), null);
        JsonNode hidden = getJson(admin, "/api/notices/" + wide);
        assertThat(hidden.path("deleted").asBoolean()).isTrue();
        assertThat(hidden.path("logs").get(1).path("action").asString()).isEqualTo("삭제");

        // other customers, outsiders of the project and operators do not learn that it exists
        expect(404, login(other.admin()), get("/api/notices/" + project), null);
        expect(404, login(other.requester()), get("/api/notices/" + project), null);
        expect(404, login(outsider(t)), get("/api/notices/" + project), null);
        expect(404, login(JUNG_OPERATOR), get("/api/notices/" + project), null);
        expect(404, req, get("/api/notices/999999999"), null);
    }
}
