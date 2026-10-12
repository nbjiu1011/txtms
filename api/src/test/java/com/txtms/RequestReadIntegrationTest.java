package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

class RequestReadIntegrationTest extends IntegrationTestBase {

    @Test
    void requesterListsProjectRequestsIncludingOwnDraftNewestFirst() throws Exception {
        Login kim = login(KIM_REQUESTER);
        long p1 = projectId("카드 혜택 알림");
        JsonNode page = getJson(kim, "/api/requests?projectId=" + p1 + "&size=100");
        List<String> ids = ids(page.path("content"));
        assertThat(ids).containsExactlyInAnyOrder("REQ-2609-101", "REQ-2609-102", "REQ-2609-103", "REQ-2609-104",
                "REQ-2609-105", "REQ-2609-088", "REQ-2609-106", "REQ-2609-107", "REQ-2609-113");
        assertThat(page.path("page").path("totalElements").asLong()).isEqualTo(9);
        assertThat(page.path("page").path("number").asInt()).isZero();
        assertThat(page.path("page").path("size").asInt()).isEqualTo(100);
        // draft has no submission time and was created today, so it sorts first
        assertThat(ids.getFirst()).isEqualTo("REQ-2609-105");
        assertThat(ids.getLast()).isEqualTo("REQ-2609-088");

        JsonNode first = page.path("content").get(1);
        assertThat(first.has("reviewerIds")).isTrue();
        assertThat(first.has("volume")).isTrue();
        assertThat(first.has("isOverdue")).isFalse();
    }

    @Test
    void othersDraftsAreHiddenFromListsAndDetail() throws Exception {
        Login park = login(PARK_REVIEWER);
        long p1 = projectId("카드 혜택 알림");
        List<String> ids = ids(getJson(park, "/api/requests?projectId=" + p1 + "&size=100").path("content"));
        assertThat(ids).hasSize(8).doesNotContain("REQ-2609-105");
        getAs(park, "/api/requests/REQ-2609-105")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DRAFT_PRIVATE"))
                .andExpect(jsonPath("$.message").value(
                        "REQ-2609-105는 아직 작성 중인 요청입니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다."));
        getAs(park, "/api/requests/REQ-2609-105/history").andExpect(jsonPath("$.code").value("DRAFT_PRIVATE"));
        getAs(park, "/api/requests/REQ-2609-105/contents/C1/versions/1")
                .andExpect(jsonPath("$.code").value("DRAFT_PRIVATE"));

        Login admin = login(KANG_ADMIN);
        getAs(admin, "/api/requests/REQ-2609-105").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DRAFT_PRIVATE"));
        // another customer and the operator still get NOT_FOUND
        getAs(login(MOON_REQUESTER), "/api/requests/REQ-2609-105").andExpect(status().isNotFound());
        getAs(login(JUNG_OPERATOR), "/api/requests/REQ-2609-105").andExpect(status().isNotFound());
        assertThat(ids(getJson(admin, "/api/requests?projectId=" + p1 + "&size=100").path("content")))
                .doesNotContain("REQ-2609-105");
    }

    @Test
    void otherTenantResourcesAreNotFound() throws Exception {
        Login moon = login(MOON_REQUESTER);
        getAs(moon, "/api/requests/REQ-2609-101").andExpect(status().isNotFound());
        getAs(moon, "/api/projects/" + projectId("카드 혜택 알림")).andExpect(status().isNotFound());
        getAs(moon, "/api/customers/" + customerId("hanbitcard.co.kr") + "/projects")
                .andExpect(status().isNotFound());
        getAs(moon, "/api/requests?projectId=" + projectId("카드 혜택 알림")).andExpect(status().isNotFound());
        getAs(moon, "/api/notices?customerId=" + customerId("hanbitcard.co.kr")).andExpect(status().isNotFound());
        getAs(moon, "/api/requests/REQ-9999-999").andExpect(status().isNotFound());

        JsonNode customers = getJson(moon, "/api/customers");
        assertThat(customers).hasSize(1);
        assertThat(customers.get(0).path("name").asString()).isEqualTo("도담생명");
        assertThat(customers.get(0).path("approvalEnabled").asBoolean()).isFalse();
    }

    @Test
    void nonMemberOfProjectCannotSeeItsRequests() throws Exception {
        Login kim = login(KIM_REQUESTER);
        // same customer, not a member of the project: FORBIDDEN (the project list itself stays NOT_FOUND)
        getAs(kim, "/api/requests/REQ-2609-110").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        getAs(kim, "/api/requests/REQ-2609-110/history").andExpect(status().isForbidden());
        getAs(kim, "/api/requests?projectId=" + projectId("리스크 고지 문자")).andExpect(status().isNotFound());
    }

    @Test
    void operatorCannotReadContent() throws Exception {
        Login operator = login(JUNG_OPERATOR);
        getAs(operator, "/api/requests/REQ-2609-101").andExpect(status().isNotFound());
        getAs(operator, "/api/requests?projectId=" + projectId("카드 혜택 알림")).andExpect(status().isNotFound());
        // operators see every customer (write tests add their own isolated test customers)
        List<String> domains = new ArrayList<>();
        getJson(operator, "/api/customers").forEach(c -> domains.add(c.path("domain").asString()));
        assertThat(domains).contains("hanbitcard.co.kr", "dodamlife.com");
        assertThat(domains.stream().filter(d -> !d.endsWith(".test"))).hasSize(2);
    }

    @Test
    void allowedActionsDependOnRoleAndState() throws Exception {
        assertThat(actions(login(KIM_REQUESTER), "REQ-2609-102"))
                .containsExactlyInAnyOrder("ANSWER", "EDIT_CONTENT", "CLONE");
        assertThat(actions(login(LEE_LEAD), "REQ-2609-102")).containsExactlyInAnyOrder("UNLOCK", "EDIT_DUE");
        assertThat(actions(login(KIM_REQUESTER), "REQ-2609-105"))
                .containsExactlyInAnyOrder("EDIT_REQUEST", "EDIT_CONTENT", "SUBMIT", "CLONE");
        assertThat(actions(login(CHOI_APPROVER), "REQ-2609-103"))
                .containsExactlyInAnyOrder("APPROVE", "REVISE", "EDIT_DUE");
        assertThat(actions(login(PARK_REVIEWER), "REQ-2609-103")).isEmpty();
        assertThat(actions(login(PARK_REVIEWER), "REQ-2609-107"))
                .containsExactlyInAnyOrder("DECIDE_RECALL", "REVIEW", "EDIT_CONTENT");
        assertThat(actions(login(KIM_REQUESTER), "REQ-2609-107")).containsExactly("CLONE");
        assertThat(actions(login(LEE_LEAD), "REQ-2609-104")).containsExactlyInAnyOrder("ASSIGN", "EDIT_DUE");
        assertThat(actions(login(KANG_ADMIN), "REQ-2609-101")).containsExactlyInAnyOrder("UNLOCK", "EDIT_DUE");
        assertThat(actions(login(KIM_REQUESTER), "REQ-2609-088"))
                .containsExactlyInAnyOrder("EXPORT", "CLONE", "FOLLOW_UP");
    }

    @Test
    void detailCarriesContentsFilesOpinionsAsksAndBundle() throws Exception {
        Login kim = login(KIM_REQUESTER);

        JsonNode r101 = getJson(kim, "/api/requests/REQ-2609-101");
        assertThat(r101.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(r101.path("contents")).hasSize(3);
        JsonNode c1 = r101.path("contents").get(0);
        assertThat(c1.path("key").asString()).isEqualTo("C1");
        assertThat(c1.path("payload").path("templateCode").asString()).isEqualTo("HB_POINT_01");
        assertThat(c1.path("payload").path("buttons").get(0).path("name").asString()).isEqualTo("이벤트 참여하기");
        assertThat(c1.path("payload").path("body").asString()).contains("#{customer_name}");
        assertThat(c1.path("versions")).hasSize(1);
        assertThat(r101.path("opinions").get(0).path("contentKey").asString()).isEqualTo("C2");
        assertThat(r101.path("opinions").get(0).path("round").asInt()).isEqualTo(1);
        assertThat(r101.path("eligibleApproverIds").get(0).asLong()).isEqualTo(userId(CHOI_APPROVER));
        assertThat(r101.path("stageTimes").path("IN_REVIEW").isNull()).isFalse();
        assertThat(r101.path("stageTimes").path("APPROVED").isNull()).isTrue();
        assertThat(r101.path("rowVersion").isNumber()).isTrue();
        assertThat(r101.path("volume").path("chars").asInt()).isPositive();
        assertThat(r101.path("dueSoon").asBoolean()).isTrue();

        JsonNode r102 = getJson(kim, "/api/requests/REQ-2609-102");
        JsonNode ask = r102.path("asks").get(0);
        assertThat(ask.path("contentKey").asString()).isEqualTo("C1");
        assertThat(ask.path("answer").isNull()).isTrue();
        assertThat(r102.path("contents").get(0).path("payload").path("customerCenter").asBoolean()).isTrue();
        assertThat(r102.path("contents").get(0).path("payload").path("optOut").asBoolean()).isTrue();

        JsonNode r103 = getJson(kim, "/api/requests/REQ-2609-103");
        assertThat(r103.path("round").asInt()).isEqualTo(2);
        assertThat(r103.path("contentVersions").get(0).asInt()).isEqualTo(2);
        assertThat(r103.path("type").asString()).isEqualTo("ALIMTALK");
        JsonNode button = r103.path("contents").get(0).path("payload").path("buttons").get(0);
        assertThat(button.path("name").asString()).isEqualTo("혜택 자세히 보기");

        JsonNode r107 = getJson(kim, "/api/requests/REQ-2609-107");
        assertThat(r107.path("recallRequested").asBoolean()).isTrue();
        assertThat(r107.path("recall").path("reason").asString()).contains("법무팀");
        JsonNode file = r107.path("contents").get(0).path("files").get(0);
        assertThat(file.path("unit").asString()).isEqualTo("PAGE");
        assertThat(file.path("totalAmount").asInt()).isEqualTo(14);
        assertThat(file.path("reviewAmount").asInt()).isEqualTo(6);
        assertThat(file.path("scanStatus").asString()).isEqualTo("SAFE");
        assertThat(r107.path("volume").path("chars").asInt()).isZero();
        assertThat(r107.path("volume").path("files").get(0).path("amount").asInt()).isEqualTo(6);

        JsonNode r113 = getJson(kim, "/api/requests/REQ-2609-113");
        assertThat(r113.path("overdue").asBoolean()).isTrue();
        assertThat(r113.path("urgency").asString()).isEqualTo("URGENT");

        JsonNode r106 = getJson(kim, "/api/requests/REQ-2609-106");
        assertThat(r106.path("parent").path("requestId").asString()).isEqualTo("REQ-2609-088");
        JsonNode bundle = r106.path("bundle");
        assertThat(bundle.path("status").asString()).isEqualTo("APPROVED");
        assertThat(bundle.path("completedBy").asLong()).isEqualTo(userId(CHOI_APPROVER));
        assertThat(bundle.path("variables").get(0).path("key").asString()).isEqualTo("customer_name");
        assertThat(bundle.path("items").get(0).path("payload").path("templateCode").asString())
                .isEqualTo("HB_BILL_02");
        assertThat(r106.path("completedAt").isNull()).isFalse();
    }

    @Test
    void historyAndContentVersions() throws Exception {
        Login kim = login(KIM_REQUESTER);
        JsonNode history = getJson(kim, "/api/requests/REQ-2609-103/history");
        List<String> actions = new ArrayList<>();
        history.forEach(h -> actions.add(h.path("action").asString()));
        assertThat(actions).containsExactly("요청 작성", "검수 요청", "검수자 배정", "검수 완료", "수정 요청", "재검수 시작",
                "문안 수정", "검수 완료");
        JsonNode edit = history.get(6);
        assertThat(edit.path("contentKey").asString()).isEqualTo("C1");
        assertThat(edit.path("contentTitle").asString()).isEqualTo("리뉴얼 혜택 안내");
        assertThat(edit.path("round").asInt()).isEqualTo(2);

        JsonNode v2 = getJson(kim, "/api/requests/REQ-2609-103/contents/C1/versions/2");
        assertThat(v2.path("version").asInt()).isEqualTo(2);
        assertThat(v2.path("createdBy").asLong()).isEqualTo(userId(PARK_REVIEWER));
        assertThat(v2.path("payload").path("templateCode").asString()).isEqualTo("HB_EVT_03");
        getAs(kim, "/api/requests/REQ-2609-103/contents/C1/versions/9").andExpect(status().isNotFound());
        getAs(login(MOON_REQUESTER), "/api/requests/REQ-2609-103/history").andExpect(status().isNotFound());
    }

    @Test
    void listFiltersAndPaging() throws Exception {
        Login lee = login(LEE_LEAD);
        long p1 = projectId("카드 혜택 알림");
        JsonNode sms = getJson(lee, "/api/requests?projectId=" + p1 + "&type=SMS&size=100");
        assertThat(ids(sms.path("content"))).containsExactlyInAnyOrder("REQ-2609-102", "REQ-2609-104",
                "REQ-2609-113");
        JsonNode search = getJson(lee, "/api/requests?projectId=" + p1 + "&q=청구");
        assertThat(ids(search.path("content"))).containsExactlyInAnyOrder("REQ-2609-088", "REQ-2609-106");
        JsonNode byPrimary = getJson(lee, "/api/requests?projectId=" + p1 + "&primaryReviewerId="
                + userId(HAN_REVIEWER));
        assertThat(ids(byPrimary.path("content"))).containsExactlyInAnyOrder("REQ-2609-106", "REQ-2609-113");

        JsonNode paged = getJson(lee, "/api/requests?projectId=" + p1 + "&size=3&page=1");
        assertThat(paged.path("content")).hasSize(3);
        assertThat(paged.path("page").path("totalElements").asLong()).isEqualTo(8);
        assertThat(paged.path("page").path("totalPages").asInt()).isEqualTo(3);
        JsonNode capped = getJson(lee, "/api/requests?projectId=" + p1 + "&size=1000");
        assertThat(capped.path("page").path("size").asInt()).isEqualTo(100);

        Login kim = login(KIM_REQUESTER);
        JsonNode mine = getJson(kim, "/api/requests?projectId=" + p1 + "&mine=true&size=100");
        assertThat(mine.path("page").path("totalElements").asLong()).isEqualTo(9);
        JsonNode approverMine = getJson(login(CHOI_APPROVER), "/api/requests?projectId=" + p1 + "&mine=true");
        assertThat(ids(approverMine.path("content"))).containsExactly("REQ-2609-103");

        getAs(lee, "/api/requests").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        getAs(lee, "/api/requests?projectId=" + p1 + "&view=CUSTOMER_COMPLETED").andExpect(status().isBadRequest());
    }

    @Test
    void customerScopeListsForAdmins() throws Exception {
        Login admin = login(KANG_ADMIN);
        long c1 = customerId("hanbitcard.co.kr");
        JsonNode inProgress = getJson(admin, "/api/requests?customerId=" + c1 + "&view=CUSTOMER_IN_PROGRESS&size=100");
        assertThat(ids(inProgress.path("content"))).containsExactlyInAnyOrder("REQ-2609-101", "REQ-2609-102",
                "REQ-2609-103", "REQ-2609-104", "REQ-2609-107", "REQ-2609-110", "REQ-2609-113");
        JsonNode completed = getJson(admin, "/api/requests?customerId=" + c1 + "&view=CUSTOMER_COMPLETED");
        assertThat(ids(completed.path("content"))).containsExactlyInAnyOrder("REQ-2609-088", "REQ-2609-106");
        assertThat(getJson(admin, "/api/customers/" + c1 + "/users")).hasSize(7);
        assertThat(getJson(admin, "/api/customers/" + c1 + "/projects")).hasSize(2);
    }

    private List<String> actions(Login login, String requestId) throws Exception {
        List<String> list = new ArrayList<>();
        getJson(login, "/api/requests/" + requestId).path("allowedActions").forEach(a -> list.add(a.asString()));
        return list;
    }

    private static List<String> ids(JsonNode content) {
        List<String> ids = new ArrayList<>();
        content.forEach(r -> ids.add(r.path("id").asString()));
        return ids;
    }
}
