package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** {@code PUT /api/me/password}: self-service password change (users of a separate tenant, never demo accounts). */
class PasswordChangeIntegrationTest extends IntegrationTestBase {

    private static final String NEW_PASSWORD = "Changed#2026";

    @Test
    void changeEndsOtherSessionsAndKeepsTheCurrentOne() throws Exception {
        Tenant t = newTenant();
        Login current = login(t.requester());
        Login other = login(t.requester());
        Login remembered = login(t.requester(), DEMO_PASSWORD, true);

        expect(204, current, put("/api/me/password"),
                Map.of("currentPassword", DEMO_PASSWORD, "newPassword", NEW_PASSWORD));

        // the current session keeps working, by access token and by refresh cookie
        assertThat(getJson(current, "/api/me").path("email").asString()).isEqualTo(t.requester());
        mvc.perform(post("/api/auth/refresh").cookie(current.refreshCookie())).andExpect(status().isOk());
        // every other session of the user has ended
        for (Login ended : new Login[] {other, remembered}) {
            getAs(ended, "/api/me").andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
            mvc.perform(post("/api/auth/refresh").cookie(ended.refreshCookie()))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
        }
        // the old password no longer works, the new one does
        assertThat(loginStatus(t.requester(), DEMO_PASSWORD)).isEqualTo(401);
        login(t.requester(), NEW_PASSWORD, false);

        long userId = userId(t.requester());
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, userId);
        assertThat(hash).startsWith("$2").doesNotContain(NEW_PASSWORD);
        Map<String, Object> audit = jdbc.queryForMap("SELECT customer_id, target, detail FROM audit_logs "
                + "WHERE action = '비밀번호 변경' AND actor_id = ? ORDER BY id DESC LIMIT 1", userId);
        assertThat(((Number) audit.get("customer_id")).longValue()).isEqualTo(t.customerId());
        assertThat(audit.get("target")).isEqualTo("사용자 req");
        assertThat(audit.get("detail")).isEqualTo("다른 세션 2개 로그아웃");
    }

    @Test
    void wrongCurrentPasswordIsAFieldError() throws Exception {
        Tenant t = newTenant();
        Login login = login(t.reviewer());
        JsonNode error = expect(400, login, put("/api/me/password"),
                Map.of("currentPassword", "Wrong!2026", "newPassword", NEW_PASSWORD));
        assertThat(error.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(error.path("fieldErrors").get(0).path("field").asString()).isEqualTo("currentPassword");
        assertThat(error.path("fieldErrors").get(0).path("message").asString()).isEqualTo("현재 비밀번호가 일치하지 않습니다");
        // nothing changed
        login(t.reviewer());
    }

    @Test
    void newPasswordMustMeetThePolicyAndDifferFromTheCurrentOne() throws Exception {
        Tenant t = newTenant();
        Login login = login(t.lead());
        for (String weak : new String[] {"short1!", "onlyletters", "12345678"}) {
            JsonNode error = expect(400, login, put("/api/me/password"),
                    Map.of("currentPassword", DEMO_PASSWORD, "newPassword", weak));
            assertThat(error.path("fieldErrors").get(0).path("field").asString()).isEqualTo("newPassword");
            assertThat(error.path("message").asString())
                    .isEqualTo("비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다");
        }
        JsonNode same = expect(400, login, put("/api/me/password"),
                Map.of("currentPassword", DEMO_PASSWORD, "newPassword", DEMO_PASSWORD));
        assertThat(same.path("fieldErrors").get(0).path("field").asString()).isEqualTo("newPassword");
        assertThat(same.path("message").asString()).isEqualTo("현재 비밀번호와 다른 비밀번호를 입력하세요");

        JsonNode missing = expect(400, login, put("/api/me/password"), Map.of("newPassword", NEW_PASSWORD));
        assertThat(missing.path("fieldErrors").get(0).path("field").asString()).isEqualTo("currentPassword");

        expect(401, null, put("/api/me/password"), Map.of("currentPassword", DEMO_PASSWORD,
                "newPassword", NEW_PASSWORD));
        // still the old password
        login(t.lead());
    }

    @Test
    void repeatedWrongCurrentPasswordsLockLikeLoginFailures() throws Exception {
        Tenant t = newTenant();
        Login login = login(t.admin());
        Map<String, String> wrong = Map.of("currentPassword", "Wrong!2026", "newPassword", NEW_PASSWORD);
        for (int i = 0; i < 4; i++) {
            expect(400, login, put("/api/me/password"), wrong);
        }
        JsonNode locked = expect(429, login, put("/api/me/password"), wrong);
        assertThat(locked.path("code").asString()).isEqualTo("RATE_LIMITED");
        // locked even with the right password, and the email login shares the lock
        expect(429, login, put("/api/me/password"), Map.of("currentPassword", DEMO_PASSWORD,
                "newPassword", NEW_PASSWORD));
        assertThat(loginStatus(t.admin(), DEMO_PASSWORD)).isEqualTo(429);

        clock.advance(Duration.ofMinutes(16));
        Login fresh = login(t.admin());
        expect(204, fresh, put("/api/me/password"), Map.of("currentPassword", DEMO_PASSWORD,
                "newPassword", NEW_PASSWORD));
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + fresh.accessToken()))
                .andExpect(status().isOk());
    }

    /** A null login sends the request without a bearer token. */
    @Override
    protected MvcResult send(Login login, MockHttpServletRequestBuilder builder, Object body) throws Exception {
        if (login != null) {
            return super.send(login, builder, body);
        }
        builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder).andReturn();
    }

    private int loginStatus(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", password, "remember", false))))
                .andReturn().getResponse().getStatus();
    }
}
