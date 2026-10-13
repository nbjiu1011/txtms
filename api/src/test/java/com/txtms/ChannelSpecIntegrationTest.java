package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Channel specification (contract §17.3): the configured spec endpoint, and spec overruns that only warn — saving,
 * submit pre-check, submit and review completion are never refused for them.
 */
class ChannelSpecIntegrationTest extends IntegrationTestBase {

    private String draft(Login req, Tenant t, String type) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", type))
                .path("id").asString();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", "채널 규격");
        info.put("hopeDueDate", "2026-12-20");
        info.put("purpose", "안내");
        info.put("target", "전체 회원");
        info.put("background", "정기 발송");
        expect(200, req, patch("/api/requests/" + id), info);
        return id;
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asString()));
        return out;
    }

    @Test
    void specComesFromConfigurationForAnyAuthenticatedUser() throws Exception {
        JsonNode spec = getJson(login(KIM_REQUESTER), "/api/channel-specs");
        assertThat(spec.toString()).isEqualTo("{\"alimtalk\":{\"bodyMaxChars\":1000,\"buttonsMax\":5,"
                + "\"buttonNameMaxChars\":14},\"sms\":{\"smsMaxBytes\":90,\"lmsMaxBytes\":2000,\"encoding\":\"EUC-KR\"}}");
        assertThat(getJson(login(JUNG_OPERATOR), "/api/channel-specs")).isEqualTo(spec);
        assertThat(mvc.perform(get("/api/channel-specs")).andReturn().getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void alimtalkOverrunsWarnButNeverBlockSubmitOrCompletion() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = draft(req, t, "ALIMTALK");
        String longName = "열네 글자를 넘는 아주 긴 버튼 이름";
        List<Map<String, String>> buttons = new ArrayList<>();
        buttons.add(Map.of("name", longName, "link", "https://a.kr"));
        for (int i = 2; i <= 6; i++) {
            buttons.add(Map.of("name", "버튼 " + i, "link", "https://a.kr/" + i));
        }
        // 1,001 code points: the emoji is one character although it is two UTF-16 units
        String body = "#{customer_name}님 " + "가".repeat(982) + "😀";
        assertThat(body.codePointCount(0, body.length())).isEqualTo(1001);
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of(
                "templateCode", "HB_POINT_01", "body", body, "buttons", buttons)));

        JsonNode check = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(check.path("ok").asBoolean()).isTrue();
        assertThat(check.path("details")).isEmpty();
        assertThat(strings(check.path("warnings"))).containsExactly("C1 콘텐츠 1: 본문 1,000자 초과 (1,001자)",
                "C1 콘텐츠 1: 버튼 5개 초과 (6개)", "C1 콘텐츠 1: 버튼명 14자 초과 (" + longName + ")");

        JsonNode submitted = expect(200, req, post("/api/requests/" + id + "/submit"),
                Map.of("rowVersion", rowVersion(req, id)));
        assertThat(submitted.path("status").asString()).isEqualTo("WAITING");

        // review completion re-checks the final contents with the same (non-blocking) rule
        Login lead = login(t.lead());
        long reviewer = userId(t.reviewer());
        Map<String, Object> assignment = new LinkedHashMap<>();
        assignment.put("reviewerIds", List.of(reviewer));
        assignment.put("primaryReviewerId", reviewer);
        assignment.put("dueDate", "2026-12-15");
        assignment.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, post("/api/requests/" + id + "/assignment"), assignment);
        Login rev = login(t.reviewer());
        JsonNode completed = expect(200, rev, post("/api/requests/" + id + "/complete"),
                Map.of("rowVersion", rowVersion(rev, id)));
        assertThat(completed.path("status").asString()).isEqualTo("REVIEW_COMPLETED");
    }

    @Test
    void smsBytesAndUnsupportedCharactersWarnIndependentlyOfOk() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = draft(req, t, "SMS");
        // 1,974 + 2 + 2 + "\n고객센터 1588-0000" (19) + "\n무료 수신거부 080-000-0000" (27) = 2,024 bytes
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of(
                "sender", "1588-0000", "body", "a".repeat(1974) + "똠😀", "customerCenter", true, "optOut", true)));
        JsonNode check = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(check.path("ok").asBoolean()).isTrue();
        assertThat(strings(check.path("warnings"))).containsExactly("C1 콘텐츠 1: LMS 2,000바이트 초과 (2,024바이트)",
                "C1 콘텐츠 1: EUC-KR로 표현할 수 없는 문자: 똠, 😀");

        // a failing rule fails the check while the warnings are still reported (84 + "#{nope}" 7 = 91 bytes)
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of(
                "sender", "1588-0000", "body", "가".repeat(42) + "#{nope}", "customerCenter", false, "optOut", false)));
        check = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(check.path("ok").asBoolean()).isFalse();
        assertThat(strings(check.path("details"))).containsExactly("C1: 등록되지 않았거나 비활성 변수 nope");
        assertThat(strings(check.path("warnings")))
                .containsExactly("C1 콘텐츠 1: SMS 90바이트 초과 — LMS 예상 전환 (91바이트)");

        // within the short SMS limit: no warnings, submit succeeds; the sender is optional (no registered numbers)
        expect(200, req, put("/api/requests/" + id + "/contents/C1"), Map.of("payload", Map.of(
                "sender", "", "body", "가".repeat(45), "customerCenter", false, "optOut", false)));
        check = expect(200, req, post("/api/requests/" + id + "/submit-check"), null);
        assertThat(check.path("ok").asBoolean()).isTrue();
        assertThat(check.path("warnings")).isEmpty();
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
    }
}
