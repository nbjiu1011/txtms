package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

class DashboardIntegrationTest extends IntegrationTestBase {

    @Test
    void leadReviewerDashboardKpisMatchTheListViews() throws Exception {
        Login lee = login(LEE_LEAD);
        long p1 = projectId("카드 혜택 알림");
        JsonNode dash = getJson(lee, "/api/projects/" + p1 + "/dashboard");

        List<String> views = new ArrayList<>();
        dash.path("kpis").forEach(k -> views.add(k.path("view").asString()));
        // 기획서 8.3: 검수자 = 내 검수 대기·진행·확인 요청, 대표 검수자 = 배정 대기·지연 (+ 납기 임박)
        assertThat(views).containsExactly("MY_REVIEW", "MY_ASSIGNED_CONFIRMING", "RECALL_PENDING",
                "WAITING_ASSIGNMENT", "OVERDUE", "DUE_SOON");
        assertThat(kpi(dash, "MY_ASSIGNED_CONFIRMING").path("label").asString()).isEqualTo("확인 요청 중");
        assertThat(kpi(dash, "MY_REVIEW").path("label").asString()).isEqualTo("내 검수");
        assertThat(kpi(dash, "MY_REVIEW").path("count").asInt()).isEqualTo(1);
        assertThat(kpi(dash, "WAITING_ASSIGNMENT").path("count").asInt()).isEqualTo(1);
        assertThat(kpi(dash, "WAITING_ASSIGNMENT").path("tone").asString()).isEqualTo("WAITING");
        assertThat(kpi(dash, "OVERDUE").path("count").asInt()).isEqualTo(1);

        for (JsonNode k : dash.path("kpis")) {
            JsonNode list = getJson(lee, "/api/requests?projectId=" + p1 + "&view=" + k.path("view").asString());
            assertThat(list.path("page").path("totalElements").asInt())
                    .as("KPI %s", k.path("view").asString())
                    .isEqualTo(k.path("count").asInt());
        }

        assertThat(dash.path("pipeline")).hasSize(6);
        assertThat(dash.path("pipeline").get(0).path("status").asString()).isEqualTo("DRAFT");
        assertThat(dash.path("pipeline").get(0).path("count").asInt()).isZero();
        assertThat(dash.path("pipelineTotal").asInt()).isEqualTo(8);
        assertThat(dash.path("recent")).hasSize(6);
        assertThat(dash.path("adminViewing").asBoolean()).isFalse();

        List<String> todoLabels = new ArrayList<>();
        dash.path("todos").forEach(t -> todoLabels.add(t.path("requestId").asString() + ":" + t.path("action").asString()));
        // 107 is under a pending recall, so it is not "review in progress" for the co-reviewer
        assertThat(todoLabels).containsExactly("REQ-2609-104:ASSIGN");

        JsonNode workload = dash.path("workload");
        assertThat(workload).hasSize(3);
        JsonNode park = row(workload, userId(PARK_REVIEWER));
        assertThat(park.path("active").asInt()).isEqualTo(3);
        assertThat(park.path("primary").asInt()).isEqualTo(2);
        assertThat(park.path("files").get(0).path("unit").asString()).isEqualTo("PAGE");
        assertThat(park.path("files").get(0).path("amount").asInt()).isEqualTo(6);

        JsonNode notices = dash.path("notices");
        assertThat(notices).hasSize(2);
        assertThat(notices.get(0).path("scope").asString()).isEqualTo("CUSTOMER");
    }

    @Test
    void requesterAndApproverDashboards() throws Exception {
        long p1 = projectId("카드 혜택 알림");
        Login kimLogin = login(KIM_REQUESTER);
        JsonNode kim = getJson(kimLogin, "/api/projects/" + p1 + "/dashboard");
        List<String> kimViews = new ArrayList<>();
        kim.path("kpis").forEach(k -> kimViews.add(k.path("view").asString()));
        // 기획서 8.3: 요청자 = 내 요청 상태별 현황 + 납기 임박
        assertThat(kimViews).containsExactly("MY_DRAFT", "MY_CONFIRMING", "MY_IN_PROGRESS", "DUE_SOON");
        for (JsonNode k : kim.path("kpis")) {
            JsonNode list = getJson(kimLogin, "/api/requests?projectId=" + p1 + "&view=" + k.path("view").asString());
            assertThat(list.path("page").path("totalElements").asInt()).as("KPI %s", k.path("view").asString())
                    .isEqualTo(k.path("count").asInt());
            list.path("content").forEach(r -> assertThat(r.path("requesterId").asLong())
                    .isEqualTo(kimLogin.userId()));
        }
        assertThat(kpi(kim, "MY_DRAFT").path("count").asInt()).isEqualTo(1);
        assertThat(kpi(kim, "MY_CONFIRMING").path("count").asInt()).isEqualTo(1);
        assertThat(kpi(kim, "MY_IN_PROGRESS").path("count").asInt()).isEqualTo(5);
        assertThat(kim.path("pipeline").get(0).path("count").asInt()).isEqualTo(1);
        assertThat(kim.path("workload")).isEmpty();
        List<String> todos = new ArrayList<>();
        kim.path("todos").forEach(t -> todos.add(t.path("label").asString()));
        assertThat(todos).containsExactlyInAnyOrder("작성 이어하기", "확인 요청에 답변");

        JsonNode choi = getJson(login(CHOI_APPROVER), "/api/projects/" + p1 + "/dashboard");
        assertThat(kpi(choi, "APPROVAL_PENDING").path("count").asInt()).isEqualTo(1);
        assertThat(choi.path("todos").get(0).path("action").asString()).isEqualTo("APPROVE");
    }

    @Test
    void customerAdminSeesCustomerKpisAndAdminBanner() throws Exception {
        Login admin = login(KANG_ADMIN);
        long p1 = projectId("카드 혜택 알림");
        JsonNode dash = getJson(admin, "/api/projects/" + p1 + "/dashboard");
        assertThat(dash.path("adminViewing").asBoolean()).isTrue();
        assertThat(kpi(dash, "CUSTOMER_IN_PROGRESS").path("count").asInt()).isEqualTo(7);
        assertThat(kpi(dash, "CUSTOMER_COMPLETED").path("count").asInt()).isEqualTo(2);
        assertThat(getJson(admin, "/api/projects/" + p1 + "/workload")).hasSize(3);
    }

    @Test
    void dashboardAndWorkloadAccess() throws Exception {
        long p1 = projectId("카드 혜택 알림");
        getAs(login(MOON_REQUESTER), "/api/projects/" + p1 + "/dashboard").andExpect(status().isNotFound());
        getAs(login(JUNG_OPERATOR), "/api/projects/" + p1 + "/dashboard").andExpect(status().isNotFound());
        getAs(login(KIM_REQUESTER), "/api/projects/" + p1 + "/workload").andExpect(status().isForbidden());

        JsonNode project = getJson(login(JUNG_OPERATOR), "/api/projects/" + p1);
        assertThat(project.path("leadUserId").asLong()).isEqualTo(userId(LEE_LEAD));
        assertThat(project.path("templates")).hasSize(3);
        assertThat(project.path("senders").get(1).asString()).isEqualTo("02-3456-7000");
        assertThat(project.path("variablesRevision").asInt()).isEqualTo(6);
    }

    @Test
    void doDamLifeDashboardUsesReviewCompletedPipeline() throws Exception {
        long p3 = projectId("계약 유지 안내");
        JsonNode dash = getJson(login(YOON_LEAD), "/api/projects/" + p3 + "/dashboard");
        assertThat(dash.path("pipeline")).hasSize(5);
        assertThat(dash.path("pipeline").get(4).path("status").asString()).isEqualTo("REVIEW_COMPLETED");
        assertThat(dash.path("pipeline").get(4).path("count").asInt()).isEqualTo(1);
    }

    @Test
    void notificationsCarryReadAndPendingSeparately() throws Exception {
        Login kim = login(KIM_REQUESTER);
        JsonNode list = getJson(kim, "/api/notifications");
        assertThat(list.path("items")).hasSize(2);
        JsonNode ask = item(list, "ASK");
        assertThat(ask.path("read").asBoolean()).isFalse();
        assertThat(ask.path("pending").asBoolean()).isTrue();
        JsonNode fin = item(list, "FINAL");
        assertThat(fin.path("read").asBoolean()).isTrue();
        assertThat(fin.path("pending").asBoolean()).isFalse();

        Login han = login(HAN_REVIEWER);
        JsonNode hanList = getJson(han, "/api/notifications");
        assertThat(hanList.path("unreadCount").asInt()).isEqualTo(1);
        JsonNode due = item(hanList, "DUE");
        assertThat(due.path("renotify").asBoolean()).isTrue();
        assertThat(due.path("pending").asBoolean()).isTrue();

        mvc.perform(post("/api/notifications/" + due.path("id").asLong() + "/read")
                .header("Authorization", "Bearer " + han.accessToken())).andExpect(status().isNoContent());
        assertThat(getJson(han, "/api/notifications").path("unreadCount").asInt()).isZero();

        mvc.perform(post("/api/notifications/" + ask.path("id").asLong() + "/read")
                .header("Authorization", "Bearer " + han.accessToken())).andExpect(status().isNotFound());

        Login lee = login(LEE_LEAD);
        mvc.perform(post("/api/notifications/read-all").header("Authorization", "Bearer " + lee.accessToken()))
                .andExpect(status().isNoContent());
        assertThat(getJson(lee, "/api/notifications").path("unreadCount").asInt()).isZero();
    }

    @Test
    void noticesAreScopedToCustomerAndProjectMembership() throws Exception {
        long c1 = customerId("hanbitcard.co.kr");
        JsonNode kim = getJson(login(KIM_REQUESTER), "/api/notices?customerId=" + c1).path("content");
        assertThat(kim).hasSize(2);
        assertThat(kim.get(0).path("logs")).isEmpty();
        assertThat(kim.get(0).path("withdrawn").asBoolean()).isFalse();
        JsonNode oh = getJson(login(OH_REQUESTER), "/api/notices?customerId=" + c1).path("content");
        assertThat(oh).hasSize(1);
        assertThat(oh.get(0).path("scope").asString()).isEqualTo("CUSTOMER");
    }

    @Test
    void contentTypesAndGuides() throws Exception {
        Login kim = login(KIM_REQUESTER);
        JsonNode types = getJson(kim, "/api/content-types");
        // Phase 1 types (RCS deferred)
        assertThat(types).hasSize(3);
        assertThat(types.get(2).path("type").asString()).isEqualTo("FREEFORM");
        assertThat(types.get(2).path("mockEnabled").asBoolean()).isFalse();
        JsonNode guide = getJson(kim, "/api/guides/SMS");
        assertThat(guide.path("goodExpressions").get(0).path("avoid").asString()).isEqualTo("금일");
        assertThat(guide.path("goodExpressions").get(0).path("prefer").asString()).isEqualTo("오늘");
        assertThat(guide.path("checklist")).hasSize(4);
    }

    private static JsonNode kpi(JsonNode dash, String view) {
        for (JsonNode k : dash.path("kpis")) {
            if (k.path("view").asString().equals(view)) {
                return k;
            }
        }
        throw new AssertionError("no KPI " + view);
    }

    private static JsonNode row(JsonNode rows, long userId) {
        for (JsonNode r : rows) {
            if (r.path("userId").asLong() == userId) {
                return r;
            }
        }
        throw new AssertionError("no workload row for " + userId);
    }

    private static JsonNode item(JsonNode list, String kind) {
        for (JsonNode n : list.path("items")) {
            if (n.path("kind").asString().equals(kind)) {
                return n;
            }
        }
        throw new AssertionError("no notification " + kind);
    }
}
