package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import com.txtms.support.IntegrationTestBase;

/**
 * With the sign-up switch off the endpoints do not exist. (Without demo mode they are closed too: the switch only
 * counts while demo mode is on.) Runs in its own context that shares the test database without cleaning it.
 */
@TestPropertySource(properties = {"app.demo.signup-enabled=false", "txtms.it.clean-database=false"})
class SignupDisabledIntegrationTest extends IntegrationTestBase {

    @Test
    void signupEndpointsAnswerNotFound() throws Exception {
        assertThat(mvc.perform(get("/api/auth/signup-options")).andReturn().getResponse().getStatus())
                .isEqualTo(404);
        assertThat(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"x\",\"email\":\"x@signup.test\",\"password\":\"Signup!2026\","
                        + "\"role\":\"OPERATOR\"}"))
                .andReturn().getResponse().getStatus()).isEqualTo(404);
    }
}
