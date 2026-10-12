package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Duration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Email change with a confirmation link (E-3.2): an accepted user's new address takes effect only when the link mailed
 * to it is used; a pending user's address still changes at once with a new invitation.
 */
class EmailChangeIntegrationTest extends IntegrationTestBase {

    private static final String SUBJECT = "TX TMS 이메일 변경 확인";
    private static final Pattern LINK = Pattern.compile("/email-change/([A-Za-z0-9_-]+)");

    // ------------------------------------------------------------------ helpers

    private static String domain(Tenant t) {
        return t.requester().substring(t.requester().indexOf('@') + 1);
    }

    private JsonNode changeEmail(int status, Login admin, Tenant t, long userId, Map<String, Object> body)
            throws Exception {
        return expect(status, admin, patch("/api/customers/" + t.customerId() + "/users/" + userId + "/email"), body);
    }

    /** Token of the newest confirmation mail to the address, as the recipient's mailbox shows it. */
    private String token(String to) {
        String body = jdbc.queryForObject("SELECT body FROM outbound_emails WHERE to_address = ? AND subject = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, to, SUBJECT);
        Matcher m = LINK.matcher(body);
        assertThat(m.find()).as("confirmation link in the mail to " + to).isTrue();
        return m.group(1);
    }

    private JsonNode inspect(String token) throws Exception {
        return read(mvc.perform(get("/api/auth/tokens/" + token)).andReturn());
    }

    private MvcResult confirm(String token) throws Exception {
        return mvc.perform(post("/api/auth/tokens/" + token + "/email-change")).andReturn();
    }

    private JsonNode member(Login viewer, String url, long userId) throws Exception {
        for (JsonNode m : getJson(viewer, url).path("content")) {
            if (m.path("user").path("id").asLong() == userId) {
                return m;
            }
        }
        throw new AssertionError("no member " + userId + " in " + url);
    }

    private int auditCount(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    private String lastAuditDetail(String action, long customerId) {
        return jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = ? AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, action, customerId);
    }

    private long lastAuditActor(String action, long customerId) {
        return jdbc.queryForObject("SELECT actor_id FROM audit_logs WHERE action = ? AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", Long.class, action, customerId);
    }

    private String storedEmail(long userId) {
        return jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId);
    }

    private int loginStatus(String email) throws Exception {
        String body = json.writeValueAsString(Map.of("email", email, "password", DEMO_PASSWORD, "remember", false));
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)).andReturn()
                .getResponse().getStatus();
    }

    // ------------------------------------------------------------------ tests

    @Test
    void confirmedLinkAppliesTheNewEmailAndEndsEverySession() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        Login reviewer = login(t.reviewer());
        long reviewerId = userId(t.reviewer());
        String moved = "rev-moved@" + domain(t);
        String base = "/api/customers/" + t.customerId();

        // ---- request: nothing changes yet, the Member shows the address awaiting confirmation
        JsonNode requested = changeEmail(200, admin, t, reviewerId, Map.of("email", moved));
        assertThat(requested.path("user").path("email").asString()).isEqualTo(t.reviewer());
        assertThat(requested.path("pendingEmail").asString()).isEqualTo(moved);
        assertThat(storedEmail(reviewerId)).isEqualTo(t.reviewer());
        assertThat(getJson(reviewer, "/api/me").path("email").asString()).isEqualTo(t.reviewer());
        assertThat(lastAuditDetail("사용자 이메일 변경 요청", t.customerId())).isEqualTo(t.reviewer() + " → " + moved);
        assertThat(auditCount("사용자 이메일 변경", t.customerId())).isZero();
        assertThat(member(admin, base + "/members?size=100", reviewerId).path("pendingEmail").asString())
                .isEqualTo(moved);
        Login operator = login(JUNG_OPERATOR);
        assertThat(member(operator, "/api/ops/customers/" + t.customerId() + "/members?size=100", reviewerId)
                .path("pendingEmail").asString()).isEqualTo(moved);
        // users without a pending change carry the key with null
        JsonNode requester = member(admin, base + "/members?size=100", userId(t.requester()));
        assertThat(requester.has("pendingEmail")).isTrue();
        assertThat(requester.path("pendingEmail").isNull()).isTrue();

        // ---- the mail goes to the new address; the admin's outbox hides the link, the demo operator sees it
        JsonNode mail = null;
        for (JsonNode m : getJson(admin, base + "/outbox?size=100").path("content")) {
            if (m.path("to").asString().equals(moved)) {
                mail = m;
            }
        }
        assertThat(mail).as("confirmation mail listed").isNotNull();
        assertThat(mail.path("subject").asString()).isEqualTo(SUBJECT);
        assertThat(mail.path("kind").asString()).isEqualTo("EMAIL_CHANGE");
        assertThat(mail.path("masked").asBoolean()).isTrue();
        assertThat(mail.path("body").asString()).contains("/email-change/••••").endsWith("링크는 수신자에게만 전달됩니다");
        String token = token(moved);
        assertThat(mail.path("body").asString()).doesNotContain(token);
        JsonNode opsMail = getJson(operator, "/api/ops/outbox?customerId=" + t.customerId() + "&size=5")
                .path("content").get(0);
        assertThat(opsMail.path("to").asString()).isEqualTo(moved);
        assertThat(opsMail.path("masked").asBoolean()).isFalse();
        assertThat(opsMail.path("body").asString()).contains("/email-change/" + token);

        // ---- inspect and confirm (public)
        JsonNode info = inspect(token);
        assertThat(info.path("kind").asString()).isEqualTo("EMAIL_CHANGE");
        assertThat(info.path("valid").asBoolean()).isTrue();
        assertThat(info.path("email").asString()).isEqualTo(moved);
        assertThat(info.path("name").asString()).isEqualTo("사용자 rev");
        assertThat(confirm(token).getResponse().getStatus()).isEqualTo(204);

        assertThat(storedEmail(reviewerId)).isEqualTo(moved);
        assertThat(getAs(reviewer, "/api/me").andReturn().getResponse().getStatus()).isEqualTo(401);
        assertThat(loginStatus(t.reviewer())).isEqualTo(401);
        assertThat(login(moved).me().path("email").asString()).isEqualTo(moved);
        assertThat(lastAuditDetail("사용자 이메일 변경", t.customerId())).isEqualTo(t.reviewer() + " → " + moved);
        assertThat(lastAuditActor("사용자 이메일 변경", t.customerId())).isEqualTo(reviewerId);
        JsonNode after = member(admin, base + "/members?size=100", reviewerId);
        assertThat(after.path("user").path("email").asString()).isEqualTo(moved);
        assertThat(after.path("pendingEmail").isNull()).isTrue();

        // ---- the link is single use, also through the password endpoint
        MvcResult reused = confirm(token);
        assertThat(reused.getResponse().getStatus()).isEqualTo(400);
        assertThat(read(reused).path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(read(reused).path("message").asString()).isEqualTo("유효하지 않은 링크입니다");
        JsonNode used = inspect(token);
        assertThat(used.path("kind").asString()).isEqualTo("EMAIL_CHANGE");
        assertThat(used.path("valid").asBoolean()).isFalse();
        assertThat(used.path("email").isNull()).isTrue();
        assertThat(mvc.perform(post("/api/auth/tokens/" + token + "/password").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "Another!2026")))).andReturn().getResponse()
                .getStatus()).isEqualTo(400);
        // an unknown token is the same error
        assertThat(confirm("no-such-token").getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void sameAddressCancelsAndANewRequestInvalidatesEarlierLinks() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        long leadId = userId(t.lead());
        String first = "lead-a@" + domain(t);
        String second = "lead-b@" + domain(t);

        // validation is unchanged: format, duplicate, external domain confirmation
        assertThat(changeEmail(400, admin, t, leadId, Map.of("email", "x@")).path("message").asString())
                .isEqualTo("이메일 형식 또는 중복을 확인하세요");
        assertThat(changeEmail(409, admin, t, leadId, Map.of("email", t.reviewer())).path("code").asString())
                .isEqualTo("DUPLICATE");
        assertThat(changeEmail(409, admin, t, leadId, Map.of("email", "lead-" + t.customerId() + "@partner.example"))
                .path("code").asString()).isEqualTo("EXTERNAL_DOMAIN_CONFIRM_REQUIRED");

        changeEmail(200, admin, t, leadId, Map.of("email", first));
        String firstToken = token(first);
        JsonNode again = changeEmail(200, admin, t, leadId, Map.of("email", second));
        assertThat(again.path("pendingEmail").asString()).isEqualTo(second);
        String secondToken = token(second);
        assertThat(inspect(firstToken).path("valid").asBoolean()).isFalse();
        assertThat(confirm(firstToken).getResponse().getStatus()).isEqualTo(400);
        assertThat(inspect(secondToken).path("valid").asBoolean()).isTrue();
        assertThat(auditCount("사용자 이메일 변경 요청", t.customerId())).isEqualTo(2);

        // the current address cancels the waiting change
        JsonNode cancelled = changeEmail(200, admin, t, leadId, Map.of("email", t.lead().toUpperCase()));
        assertThat(cancelled.path("pendingEmail").isNull()).isTrue();
        assertThat(cancelled.path("user").path("email").asString()).isEqualTo(t.lead());
        assertThat(inspect(secondToken).path("valid").asBoolean()).isFalse();
        assertThat(confirm(secondToken).getResponse().getStatus()).isEqualTo(400);
        assertThat(auditCount("사용자 이메일 변경 취소", t.customerId())).isEqualTo(1);
        assertThat(lastAuditDetail("사용자 이메일 변경 취소", t.customerId())).contains(second);
        assertThat(storedEmail(leadId)).isEqualTo(t.lead());

        // nothing waiting: no change, no audit
        changeEmail(200, admin, t, leadId, Map.of("email", t.lead()));
        assertThat(auditCount("사용자 이메일 변경 취소", t.customerId())).isEqualTo(1);
        assertThat(auditCount("사용자 이메일 변경", t.customerId())).isZero();
    }

    @Test
    void expiredLinkAndAnAddressTakenMeanwhile() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        long requesterId = userId(t.requester());
        String base = "/api/customers/" + t.customerId();

        // 24 hours
        String late = "req-late@" + domain(t);
        changeEmail(200, admin, t, requesterId, Map.of("email", late));
        String lateToken = token(late);
        clock.advance(Duration.ofHours(24).plusMinutes(1));
        assertThat(inspect(lateToken).path("valid").asBoolean()).isFalse();
        assertThat(confirm(lateToken).getResponse().getStatus()).isEqualTo(400);
        // (the admin's access token has expired by now as well, so the member list is checked by the token only)
        clock.reset();

        // another account takes the address before the link is used
        String taken = "req-taken@" + domain(t);
        changeEmail(200, admin, t, requesterId, Map.of("email", taken));
        String takenToken = token(taken);
        expect(201, admin, post(base + "/invitations"), Map.of("email", taken, "name", "먼저 온 손님"));
        MvcResult duplicate = confirm(takenToken);
        assertThat(duplicate.getResponse().getStatus()).isEqualTo(409);
        assertThat(read(duplicate).path("code").asString()).isEqualTo("DUPLICATE");
        assertThat(read(duplicate).path("message").asString()).isEqualTo("이메일 형식 또는 중복을 확인하세요");
        assertThat(storedEmail(requesterId)).isEqualTo(t.requester());
        assertThat(loginStatus(t.requester())).isEqualTo(200);
        assertThat(auditCount("사용자 이메일 변경", t.customerId())).isZero();
    }

    @Test
    void pendingUsersStillChangeAtOnceWithANewInvitation() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        String base = "/api/customers/" + t.customerId();
        String invitedEmail = "guest@" + domain(t);
        String moved = "guest-moved@" + domain(t);
        long guestId = expect(201, admin, post(base + "/invitations"), Map.of("email", invitedEmail, "name", "손님"))
                .path("user").path("id").asLong();

        JsonNode changed = changeEmail(200, admin, t, guestId, Map.of("email", moved));
        assertThat(changed.path("user").path("email").asString()).isEqualTo(moved);
        assertThat(changed.path("pending").asBoolean()).isTrue();
        assertThat(changed.path("pendingEmail").isNull()).isTrue();
        assertThat(storedEmail(guestId)).isEqualTo(moved);
        assertThat(lastAuditDetail("사용자 이메일 변경", t.customerId())).isEqualTo(invitedEmail + " → " + moved);
        assertThat(auditCount("사용자 이메일 변경 요청", t.customerId())).isZero();
        assertThat(jdbc.queryForObject("SELECT kind FROM outbound_emails WHERE to_address = ? ORDER BY id DESC "
                + "LIMIT 1", String.class, moved)).isEqualTo("INVITATION");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM outbound_emails WHERE customer_id = ? AND kind = ?",
                Integer.class, t.customerId(), "EMAIL_CHANGE")).isZero();
    }
}
