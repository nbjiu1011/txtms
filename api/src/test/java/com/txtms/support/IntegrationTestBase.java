package com.txtms.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Full application against the local MySQL test database, seeded with the demo data. */
@Tag("integration")
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("it")
@Import(IntegrationTestConfig.class)
public abstract class IntegrationTestBase {

    public static final String DEMO_PASSWORD = "Txtms!2026";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JsonMapper json;

    @Autowired
    protected MutableClock clock;

    @Autowired
    protected JdbcTemplate jdbc;

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    /** A logged-in session: bearer token, refresh cookie and the Me body. */
    protected record Login(String accessToken, Cookie refreshCookie, JsonNode me) {
        public long userId() {
            return me.path("id").asLong();
        }
    }

    protected Login login(String email) throws Exception {
        return login(email, DEMO_PASSWORD, false);
    }

    protected Login login(String email, String password, boolean remember) throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("email", email, "password", password,
                "remember", remember));
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn();
        if (result.getResponse().getStatus() != 200) {
            throw new AssertionError("login failed for " + email + ": " + text(result));
        }
        return toLogin(result);
    }

    protected Login toLogin(MvcResult result) throws Exception {
        JsonNode node = read(result);
        return new Login(node.path("accessToken").asString(), result.getResponse().getCookie("txtms_refresh"),
                node.path("me"));
    }

    protected ResultActions getAs(Login login, String url) throws Exception {
        return mvc.perform(get(url).header("Authorization", "Bearer " + login.accessToken()));
    }

    /** GET expecting 200 and returning the parsed body. */
    protected JsonNode getJson(Login login, String url) throws Exception {
        MvcResult result = getAs(login, url).andReturn();
        if (result.getResponse().getStatus() != 200) {
            throw new AssertionError("GET " + url + " -> " + result.getResponse().getStatus() + " " + text(result));
        }
        return read(result);
    }

    protected JsonNode read(MvcResult result) throws Exception {
        return json.readTree(text(result));
    }

    protected static String text(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    protected long userId(String email) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    }

    protected long projectId(String name) {
        return jdbc.queryForObject("SELECT id FROM projects WHERE name = ?", Long.class, name);
    }

    protected long customerId(String domain) {
        return jdbc.queryForObject("SELECT id FROM customers WHERE domain = ?", Long.class, domain);
    }

    // ------------------------------------------------------------------ write helpers

    /** Sends a JSON request (body may be null) as the user. */
    protected MvcResult send(Login login, MockHttpServletRequestBuilder builder, Object body) throws Exception {
        builder.header("Authorization", "Bearer " + login.accessToken());
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON)
                    .content(body instanceof String s ? s : json.writeValueAsString(body));
        }
        return mvc.perform(builder).andReturn();
    }

    /** Sends a JSON request and asserts the status; returns the parsed body (null when empty). */
    protected JsonNode expect(int status, Login login, MockHttpServletRequestBuilder builder, Object body)
            throws Exception {
        MvcResult result = send(login, builder, body);
        if (result.getResponse().getStatus() != status) {
            throw new AssertionError(result.getRequest().getMethod() + " " + result.getRequest().getRequestURI()
                    + " -> " + result.getResponse().getStatus() + " (expected " + status + ") " + text(result));
        }
        String t = text(result);
        return t.isEmpty() ? null : json.readTree(t);
    }

    protected MvcResult upload(Login login, String url, String fileName, byte[] content, String demoOutcome)
            throws Exception {
        var b = MockMvcRequestBuilders.multipart(url)
                .file(new MockMultipartFile("file", fileName, "application/octet-stream", content))
                .header("Authorization", "Bearer " + login.accessToken());
        if (demoOutcome != null) {
            b.header("X-Demo-Scan-Outcome", demoOutcome);
        }
        return mvc.perform(b).andReturn();
    }

    private static final AtomicInteger TENANTS = new AtomicInteger();

    /**
     * A separate customer with its own project and users, so tests that write never change the demo tenants other
     * tests count on. Every account uses the demo password. Approval is not used.
     */
    protected record Tenant(long customerId, long projectId, String requester, String requester2, String lead,
            String reviewer, String admin) {
    }

    protected Tenant newTenant() {
        int n = TENANTS.incrementAndGet() + (int) (System.nanoTime() % 100_000);
        String domain = "m1-" + n + ".test";
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        jdbc.update("INSERT INTO customers (name, domain, approval_enabled, active, sample, notify_channel, "
                + "due_soon_days, created_at, updated_at) VALUES (?, ?, 0, 1, 0, 'IN_APP', 3, ?, ?)",
                "테스트고객 " + n, domain, now, now);
        long customerId = jdbc.queryForObject("SELECT id FROM customers WHERE domain = ?", Long.class, domain);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class,
                KIM_REQUESTER);
        String[] names = {"req", "req2", "lead", "rev", "admin"};
        long[] ids = new long[names.length];
        for (int i = 0; i < names.length; i++) {
            String email = names[i] + "@" + domain;
            jdbc.update("INSERT INTO users (customer_id, email, name, dept, active, pending, operator, demo, "
                    + "avatar_color, password_hash, created_at, updated_at) VALUES (?, ?, ?, '테스트팀', 1, 0, 0, 0, "
                    + "'#123456', ?, ?, ?)", customerId, email, "사용자 " + names[i], hash, now, now);
            ids[i] = userId(email);
        }
        jdbc.update("INSERT INTO customer_admins (user_id, customer_id) VALUES (?, ?)", ids[4], customerId);
        jdbc.update("INSERT INTO projects (customer_id, name, active, lead_user_id, variables_revision, created_at, "
                + "updated_at) VALUES (?, ?, 1, ?, 0, ?, ?)", customerId, "작성 테스트 " + n, ids[2], now, now);
        long projectId = jdbc.queryForObject("SELECT id FROM projects WHERE customer_id = ?", Long.class, customerId);
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'REQUESTER'), "
                + "(?, ?, 'REQUESTER'), (?, ?, 'REVIEWER'), (?, ?, 'REVIEWER')",
                projectId, ids[0], projectId, ids[1], projectId, ids[2], projectId, ids[3]);
        jdbc.update("INSERT INTO project_templates (project_id, sort_order, code, name) VALUES (?, 0, 'HB_POINT_01', "
                + "'포인트 적립 안내')", projectId);
        jdbc.update("INSERT INTO project_senders (project_id, sort_order, sender_number) VALUES (?, 0, '1588-0000')",
                projectId);
        jdbc.update("INSERT INTO variables (project_id, var_key, description, var_type, value, active, deleted, "
                + "created_by, created_at, updated_at) VALUES (?, 'customer_name', '고객명', 'TEXT', '홍길동', 1, 0, ?, ?, ?)",
                projectId, ids[4], now, now);
        return new Tenant(customerId, projectId, names[0] + "@" + domain, names[1] + "@" + domain,
                names[2] + "@" + domain, names[3] + "@" + domain, names[4] + "@" + domain);
    }

    // demo accounts
    protected static final String KIM_REQUESTER = "seoyeon.kim@hanbitcard.co.kr";
    protected static final String PARK_REVIEWER = "jihoon.park@hanbitcard.co.kr";
    protected static final String LEE_LEAD = "dohyun.lee@hanbitcard.co.kr";
    protected static final String CHOI_APPROVER = "mina.choi@hanbitcard.co.kr";
    protected static final String JUNG_OPERATOR = "woojin.jung@txtms.io";
    protected static final String HAN_REVIEWER = "gaeul.han@hanbitcard.co.kr";
    protected static final String OH_REQUESTER = "serin.oh@hanbitcard.co.kr";
    protected static final String YOON_LEAD = "taeo.yoon@dodamlife.com";
    protected static final String MOON_REQUESTER = "jia.moon@dodamlife.com";
    protected static final String SHIN_REVIEWER = "hajun.shin@dodamlife.com";
    protected static final String KANG_ADMIN = "minho.kang@hanbitcard.co.kr";
    protected static final String SEO_ADMIN = "aram.seo@dodamlife.com";
}
