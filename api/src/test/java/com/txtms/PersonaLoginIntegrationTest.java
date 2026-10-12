package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * One-click persona login switched on ({@code app.demo.persona-login-enabled=true}), as the client's role demo asks
 * for. Runs in its own application context that shares the test database without cleaning it.
 */
@TestPropertySource(properties = {"app.demo.persona-login-enabled=true", "txtms.it.clean-database=false"})
class PersonaLoginIntegrationTest extends IntegrationTestBase {

    @Test
    void personaListAndDemoLoginMakeDemoSessions() throws Exception {
        MvcResult personas = mvc.perform(get("/api/auth/demo-personas")).andExpect(status().isOk()).andReturn();
        JsonNode list = read(personas);
        assertThat(list).isNotEmpty();
        List<String> names = new ArrayList<>();
        list.forEach(p -> names.add(p.path("name").asString()));
        assertThat(names).contains("김서연");
        JsonNode kim = null;
        for (JsonNode p : list) {
            if ("김서연".equals(p.path("name").asString())) {
                kim = p;
            }
        }
        assertThat(kim.path("roleLabel").asString()).isEqualTo("요청자");
        assertThat(kim.path("avatarColor").asString()).isEqualTo("#3C6E71");

        long userId = kim.path("userId").asLong();
        MvcResult result = mvc.perform(post("/api/auth/demo-login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("userId", userId))))
                .andExpect(status().isOk())
                .andReturn();
        Login login = toLogin(result);
        assertThat(login.me().path("id").asLong()).isEqualTo(userId);
        assertThat(login.me().path("demo").asBoolean()).isTrue();
        assertThat(login.refreshCookie()).isNotNull();
    }

    @Test
    void emailLoginOfADemoAccountIsADemoSessionToo() throws Exception {
        assertThat(login(PARK_REVIEWER).me().path("demo").asBoolean()).isTrue();
    }
}
