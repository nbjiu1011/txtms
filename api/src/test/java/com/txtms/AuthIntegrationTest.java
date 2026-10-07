package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;

class AuthIntegrationTest extends IntegrationTestBase {

    @Test
    void emailLoginReturnsTokenCookieAndMe() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", "SEOYEON.KIM@hanbitcard.co.kr", "password", DEMO_PASSWORD,
                        "remember", false))))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("txtms_refresh="),
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("SameSite=Strict"),
                        org.hamcrest.Matchers.containsString("Path=/api/auth"))))
                .andReturn();
        Login login = toLogin(result);
        assertThat(login.accessToken()).isNotBlank();

        JsonNode me = getJson(login, "/api/me");
        assertThat(me.path("name").asString()).isEqualTo("김서연");
        assertThat(me.path("operator").asBoolean()).isFalse();
        assertThat(me.has("isOperator")).isFalse();
        assertThat(me.path("demo").asBoolean()).isTrue();
        assertThat(me.path("memberships")).hasSize(1);
        assertThat(me.path("memberships").get(0).path("roles").get(0).asString()).isEqualTo("REQUESTER");
        assertThat(me.path("memberships").get(0).path("lead").asBoolean()).isFalse();
        assertThat(me.path("session").path("remember").asBoolean()).isFalse();
        assertThat(me.path("session").path("expiresAt").asString()).endsWith("Z");
    }

    @Test
    void meShowsLeadAndAdminRoles() throws Exception {
        JsonNode lead = login(LEE_LEAD).me();
        assertThat(lead.path("memberships")).hasSize(2);
        assertThat(lead.path("memberships").get(0).path("lead").asBoolean()).isTrue();

        JsonNode admin = login(KANG_ADMIN).me();
        assertThat(admin.path("adminCustomerIds").get(0).asLong()).isEqualTo(customerId("hanbitcard.co.kr"));
        assertThat(admin.path("memberships")).isEmpty();

        JsonNode operator = login(JUNG_OPERATOR).me();
        assertThat(operator.path("operator").asBoolean()).isTrue();
        assertThat(operator.path("customerId").isNull()).isTrue();
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameMessage() throws Exception {
        String wrong = loginFailure(KIM_REQUESTER, "Wrong!2026");
        String unknown = loginFailure("nobody-" + System.nanoTime() + "@example.com", "Wrong!2026");
        assertThat(wrong).isEqualTo(unknown).contains("UNAUTHENTICATED").contains("이메일 또는 비밀번호를 확인하세요");
    }

    @Test
    void fiveConsecutiveFailuresLockTheEmailForFifteenMinutes() throws Exception {
        String email = "locked-" + System.nanoTime() + "@example.com";
        for (int i = 0; i < 4; i++) {
            assertThat(loginFailure(email, "Wrong!2026")).contains("UNAUTHENTICATED");
        }
        assertThat(loginFailure(email, "Wrong!2026")).contains("RATE_LIMITED");
        assertThat(loginFailure(email, "Wrong!2026")).contains("RATE_LIMITED");
        clock.advance(Duration.ofMinutes(16));
        assertThat(loginFailure(email, "Wrong!2026")).contains("UNAUTHENTICATED");
    }

    @Test
    void requestsWithoutTokenAreUnauthenticated() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/me").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void demoPersonasAndDemoLogin() throws Exception {
        MvcResult personas = mvc.perform(get("/api/auth/demo-personas")).andExpect(status().isOk()).andReturn();
        JsonNode list = read(personas);
        assertThat(list).hasSize(9);
        assertThat(list.get(0).path("name").asString()).isEqualTo("김서연");
        assertThat(list.get(0).path("roleLabel").asString()).isEqualTo("요청자");
        assertThat(list.get(0).path("avatarColor").asString()).isEqualTo("#3C6E71");

        long u1 = list.get(0).path("userId").asLong();
        MvcResult result = mvc.perform(post("/api/auth/demo-login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("userId", u1))))
                .andExpect(status().isOk())
                .andReturn();
        Login login = toLogin(result);
        assertThat(login.me().path("id").asLong()).isEqualTo(u1);
        assertThat(login.me().path("demo").asBoolean()).isTrue();
        assertThat(login.refreshCookie()).isNotNull();
    }

    @Test
    void refreshCookieIssuesNewAccessTokenAndLogoutEndsTheSession() throws Exception {
        Login login = login(PARK_REVIEWER);
        MvcResult refreshed = mvc.perform(post("/api/auth/refresh").cookie(login.refreshCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me.name").value("박지훈"))
                .andReturn();
        String newToken = read(refreshed).path("accessToken").asString();
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + newToken)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));

        mvc.perform(post("/api/auth/refresh").cookie(login.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + newToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
    }

    @Test
    void refreshWithoutCookieIsSessionExpired() throws Exception {
        mvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("txtms_refresh", "forged")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
    }

    @Test
    void sessionExpiresAfterThirtyMinutesWithoutActivity() throws Exception {
        Login login = login(PARK_REVIEWER);
        clock.advance(Duration.ofMinutes(20));
        refreshOk(login);
        clock.advance(Duration.ofMinutes(20));
        refreshOk(login); // 40 minutes since login, 20 since the last activity
        clock.advance(Duration.ofMinutes(31));
        mvc.perform(post("/api/auth/refresh").cookie(login.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
    }

    @Test
    void accessTokenExpiresAfterFifteenMinutes() throws Exception {
        Login login = login(PARK_REVIEWER);
        clock.advance(Duration.ofMinutes(16));
        getAs(login, "/api/me")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        refreshOk(login);
    }

    @Test
    void rememberedSessionIgnoresIdleTimeoutButEndsAfterFourteenDays() throws Exception {
        Login login = login(PARK_REVIEWER, DEMO_PASSWORD, true);
        assertThat(login.refreshCookie().getMaxAge()).isEqualTo((int) Duration.ofDays(14).toSeconds());
        clock.advance(Duration.ofHours(5));
        refreshOk(login);
        clock.advance(Duration.ofDays(14));
        mvc.perform(post("/api/auth/refresh").cookie(login.refreshCookie()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_EXPIRED"));
    }

    @Test
    void logoutReleasesContentLocksOfTheUser() throws Exception {
        long han = userId(HAN_REVIEWER);
        jdbc.update("UPDATE contents SET lock_user_id = ?, lock_at = UTC_TIMESTAMP(6) WHERE request_id = 'REQ-2609-113'",
                han);
        Login login = login(HAN_REVIEWER);
        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + login.accessToken()))
                .andExpect(status().isNoContent());
        Integer locks = jdbc.queryForObject("SELECT count(*) FROM contents WHERE lock_user_id = ?", Integer.class, han);
        assertThat(locks).isZero();
    }

    @Test
    void passwordResetFlowThroughTheOutbox() throws Exception {
        mvc.perform(post("/api/auth/password-reset-requests").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", "unknown-" + System.nanoTime() + "@example.com"))))
                .andExpect(status().isAccepted());
        mvc.perform(post("/api/auth/password-reset-requests").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", SHIN_REVIEWER))))
                .andExpect(status().isAccepted());

        String mail = jdbc.queryForObject(
                "SELECT body FROM outbound_emails WHERE to_address = ? ORDER BY id DESC LIMIT 1", String.class,
                SHIN_REVIEWER);
        String token = mail.substring(mail.indexOf("/reset/") + "/reset/".length()).trim();
        assertThat(jdbc.queryForObject("SELECT kind FROM outbound_emails WHERE to_address = ? ORDER BY id DESC "
                + "LIMIT 1", String.class, SHIN_REVIEWER)).isEqualTo("PASSWORD_RESET");
        Integer stored = jdbc.queryForObject("SELECT count(*) FROM password_resets WHERE token_hash = ?",
                Integer.class, token);
        assertThat(stored).as("raw token must not be stored").isZero();

        mvc.perform(get("/api/auth/tokens/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("PASSWORD_RESET"))
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.email").value(SHIN_REVIEWER));

        mvc.perform(post("/api/auth/tokens/" + token + "/password").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("password", "short"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("password"));

        MvcResult done = mvc.perform(post("/api/auth/tokens/" + token + "/password")
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("password", "NewPass#2026"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me.email").value(SHIN_REVIEWER))
                .andReturn();
        assertThat(read(done).path("accessToken").asString()).isNotBlank();

        mvc.perform(get("/api/auth/tokens/" + token)).andExpect(jsonPath("$.valid").value(false));
        assertThat(loginFailure(SHIN_REVIEWER, DEMO_PASSWORD)).contains("UNAUTHENTICATED");
        login(SHIN_REVIEWER, "NewPass#2026", false);
    }

    @Test
    void updateMeChangesNameAndDeptOnly() throws Exception {
        Login login = login(SEO_ADMIN);
        MvcResult result = mvc.perform(patch("/api/me").header("Authorization", "Bearer " + login.accessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "서아람", "dept", "디지털혁신팀"))))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(read(result).path("dept").asString()).isEqualTo("디지털혁신팀");

        mvc.perform(patch("/api/me").header("Authorization", "Bearer " + login.accessToken())
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("name", " "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));
    }

    private void refreshOk(Login login) throws Exception {
        mvc.perform(post("/api/auth/refresh").cookie(login.refreshCookie())).andExpect(status().isOk());
    }

    private String loginFailure(String email, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("email", email, "password", password, "remember", false))))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isIn(401, 429);
        return text(result);
    }

    private String body(Map<String, ?> values) {
        return json.writeValueAsString(values);
    }
}
