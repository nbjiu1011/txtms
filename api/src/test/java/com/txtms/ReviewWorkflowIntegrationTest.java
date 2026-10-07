package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.txtms.domain.request.service.ContentLockService;
import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * Assignment and review: assign → lock → revision → conflicts → opinion → ask (locks released) → requester revises
 * while answering → answer (round 2) → reviewer change → recall reject/approve → resubmit (round + 1), schedule
 * changes, automatic and forced lock release. Runs on its own tenant.
 */
class ReviewWorkflowIntegrationTest extends IntegrationTestBase {

    @Autowired
    ContentLockService lockService;

    // ------------------------------------------------------------------ helpers

    private long addUser(Tenant t, String local, String role) {
        String domain = t.requester().substring(t.requester().indexOf('@') + 1);
        String email = local + "@" + domain;
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class,
                KIM_REQUESTER);
        jdbc.update("INSERT INTO users (customer_id, email, name, dept, active, pending, operator, demo, avatar_color, "
                + "password_hash, created_at, updated_at) VALUES (?, ?, ?, '테스트팀', 1, 0, 0, 0, '#123456', ?, ?, ?)",
                t.customerId(), email, "사용자 " + local, hash, now, now);
        long id = userId(email);
        jdbc.update("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)", t.projectId(), id,
                role);
        return id;
    }

    private static String email(Tenant t, String local) {
        return local + t.requester().substring(t.requester().indexOf('@'));
    }

    /** SMS request with C1 and C2, submitted (WAITING). */
    private String submitted(Login req, Tenant t, String title) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("id").asString();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", title);
        info.put("hopeDueDate", "2026-12-20");
        info.put("purpose", "안내");
        info.put("target", "전체 회원");
        info.put("background", "정책 변경");
        expect(200, req, patch("/api/requests/" + id), info);
        expect(201, req, post("/api/requests/" + id + "/contents"), null);
        for (String key : List.of("C1", "C2")) {
            expect(200, req, put("/api/requests/" + id + "/contents/" + key),
                    Map.of("payload", sms("본문 " + key)));
        }
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
        return id;
    }

    private static Map<String, Object> sms(String body) {
        return Map.of("sender", "1588-0000", "body", body, "customerCenter", false, "optOut", false);
    }

    private long rowVersion(Login login, String id) throws Exception {
        return getJson(login, "/api/requests/" + id).path("rowVersion").asLong();
    }

    private JsonNode assign(Login lead, String id, List<Long> reviewers, Long primary) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reviewerIds", reviewers);
        body.put("primaryReviewerId", primary);
        body.put("dueDate", "2026-12-15");
        body.put("urgency", "URGENT");
        body.put("rowVersion", rowVersion(lead, id));
        return expect(200, lead, post("/api/requests/" + id + "/assignment"), body);
    }

    private JsonNode content(Login login, String id, String key) throws Exception {
        for (JsonNode c : getJson(login, "/api/requests/" + id).path("contents")) {
            if (c.path("key").asString().equals(key)) {
                return c;
            }
        }
        throw new AssertionError("no content " + key);
    }

    private Map<String, Object> revision(int baseVersion, String body) {
        return Map.of("baseVersion", baseVersion, "payload", sms(body));
    }

    private List<JsonNode> history(String id) {
        List<JsonNode> out = new ArrayList<>();
        jdbc.query("SELECT action, detail, actor_id, content_key, round FROM request_history WHERE request_id = ? "
                + "ORDER BY id", rs -> {
                    out.add(json.createObjectNode().put("action", rs.getString(1)).put("detail", rs.getString(2))
                            .put("actorId", rs.getObject(3) == null ? null : rs.getLong(3))
                            .put("contentKey", rs.getString(4)).put("round", rs.getInt(5)));
                }, id);
        return out;
    }

    private JsonNode last(String id, String action) {
        List<JsonNode> matches = history(id).stream().filter(h -> h.path("action").asString().equals(action))
                .toList();
        assertThat(matches).as("history " + action).isNotEmpty();
        return matches.getLast();
    }

    private long count(String id, String action) {
        return history(id).stream().filter(h -> h.path("action").asString().equals(action)).count();
    }

    /** Recipients of the notifications of a request whose text starts with {@code prefix}. */
    private Set<Long> recipients(String id, String prefix) {
        return new HashSet<>(jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND text LIKE ?",
                Long.class, id, prefix + "%"));
    }

    private void ageLock(String id, String key) {
        jdbc.update("UPDATE contents SET lock_at = ? WHERE request_id = ? AND content_key = ?",
                LocalDateTime.ofInstant(clock.instant().minus(Duration.ofMinutes(31)), ZoneOffset.UTC), id, key);
    }

    private static List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asString()));
        return out;
    }

    // ------------------------------------------------------------------ tests

    @Test
    void assignLockReviseAskAndAnswer() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        long reqId = req.userId();
        long leadId = lead.userId();
        long revId = rev.userId();
        String id = submitted(req, t, "검수 시나리오");

        // ---- assignment: denials
        String url = "/api/requests/" + id + "/assignment";
        long rv = rowVersion(lead, id);
        expect(409, req, post(url), Map.of("reviewerIds", List.of(revId), "dueDate", "2026-12-15", "rowVersion", rv));
        assertThat(expect(400, lead, post(url), Map.of("reviewerIds", List.of(), "dueDate", "2026-12-15",
                "rowVersion", rv)).path("message").asString()).isEqualTo("검수자를 한 명 이상 고르세요");
        assertThat(expect(400, lead, post(url), Map.of("reviewerIds", List.of(reqId), "dueDate", "2026-12-15",
                "rowVersion", rv)).path("fieldErrors").get(0).path("field").asString()).isEqualTo("reviewerIds");
        assertThat(expect(400, lead, post(url), Map.of("reviewerIds", List.of(revId, leadId),
                "dueDate", "2026-12-15", "rowVersion", rv)).path("message").asString()).isEqualTo("주담당 검수자를 지정하세요");
        assertThat(expect(400, lead, post(url), Map.of("reviewerIds", List.of(revId), "rowVersion", rv))
                .path("message").asString()).isEqualTo("확정 납기를 입력하세요");
        expect(400, lead, post(url), Map.of("reviewerIds", List.of(revId), "dueDate", "2026-12-15"));
        expect(409, lead, post(url), Map.of("reviewerIds", List.of(revId), "dueDate", "2026-12-15",
                "rowVersion", rv - 1));

        // ---- assignment
        JsonNode assigned = assign(lead, id, List.of(revId, leadId), revId);
        assertThat(assigned.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(assigned.path("reviewerIds").toString()).isEqualTo("[" + revId + "," + leadId + "]");
        assertThat(assigned.path("primaryReviewerId").asLong()).isEqualTo(revId);
        assertThat(assigned.path("dueDate").asString()).isEqualTo("2026-12-15");
        assertThat(assigned.path("hopeDueDate").asString()).isEqualTo("2026-12-20");
        assertThat(assigned.path("urgency").asString()).isEqualTo("URGENT");
        assertThat(assigned.path("stageTimes").path("IN_REVIEW").isNull()).isFalse();
        assertThat(strings(assigned.path("allowedActions"))).contains("CHANGE_ASSIGNMENT", "UNLOCK", "EDIT_DUE",
                "REVIEW", "EDIT_CONTENT");
        assertThat(last(id, "납기 변경").path("detail").asString())
                .isEqualTo("확정 납기 2026-12-20 → 2026-12-15, 긴급도 보통 → 긴급 (배정 시 확정)");
        assertThat(last(id, "검수자 배정").path("detail").asString()).isEqualTo("사용자 rev, 사용자 lead 배정, 주담당 사용자 rev");
        assertThat(recipients(id, "검수 시나리오: ")).containsExactlyInAnyOrder(reqId, revId);
        assertThat(strings(getJson(rev, "/api/requests/" + id).path("allowedActions")))
                .contains("REVIEW", "EDIT_CONTENT").doesNotContain("CHANGE_ASSIGNMENT", "UNLOCK");
        assertThat(strings(getJson(req, "/api/requests/" + id).path("allowedActions"))).contains("RECALL")
                .doesNotContain("EDIT_CONTENT", "CANCEL");

        // ---- locks: acquire, conflict, requester cannot lock in review
        String c1 = "/api/requests/" + id + "/contents/C1";
        JsonNode lock = expect(200, rev, post(c1 + "/lock"), null);
        assertThat(lock.path("userId").asLong()).isEqualTo(revId);
        assertThat(Duration.between(Instant.parse(lock.path("lockedAt").asString()),
                Instant.parse(lock.path("expiresAt").asString()))).isEqualTo(Duration.ofMinutes(30));
        expect(200, rev, post(c1 + "/lock"), null); // refresh
        JsonNode taken = expect(409, lead, post(c1 + "/lock"), null);
        assertThat(taken.path("code").asString()).isEqualTo("LOCKED_BY_OTHER");
        assertThat(taken.path("message").asString()).startsWith("사용자 rev님이 이 문안을 편집 중입니다");
        expect(409, req, post(c1 + "/lock"), null);
        assertThat(content(lead, id, "C1").path("lock").path("userId").asLong()).isEqualTo(revId);
        assertThat(content(lead, id, "C1").path("lock").path("expiresAt").isString()).isTrue();

        // ---- revisions: other's lock, no change, change, stale base, no lock, title change
        assertThat(expect(409, lead, post(c1 + "/revisions"), revision(1, "검수자 수정")).path("code").asString())
                .isEqualTo("LOCKED_BY_OTHER");
        JsonNode same = expect(200, rev, post(c1 + "/revisions"), revision(1, "본문 C1"));
        assertThat(same.path("version").asInt()).isEqualTo(1);
        assertThat(same.path("lock").isNull()).isTrue();
        assertThat(count(id, "문안 수정")).isZero();
        assertThat(expect(409, rev, post(c1 + "/revisions"), revision(1, "검수자 수정")).path("message").asString())
                .isEqualTo("편집 잠금이 만료되었습니다. 최신 버전을 다시 불러오세요");
        expect(200, rev, post(c1 + "/lock"), null);
        assertThat(expect(400, rev, post(c1 + "/revisions"), Map.of("baseVersion", 1, "title", "새 제목",
                "payload", sms("x"))).path("message").asString()).isEqualTo("콘텐츠 제목은 작성 중에만 바꿀 수 있습니다");
        expect(400, rev, post(c1 + "/revisions"), Map.of("baseVersion", 1, "payload", Map.of("text", "자유형 키")));
        JsonNode v2 = expect(200, rev, post(c1 + "/revisions"), revision(1, "검수자 수정"));
        assertThat(v2.path("version").asInt()).isEqualTo(2);
        assertThat(v2.path("payload").path("body").asString()).isEqualTo("검수자 수정");
        assertThat(v2.path("versions")).hasSize(2);
        assertThat(v2.path("lock").isNull()).isTrue();
        assertThat(last(id, "문안 수정").path("detail").asString()).isEqualTo("v1 → v2");
        assertThat(last(id, "문안 수정").path("contentKey").asString()).isEqualTo("C1");
        JsonNode snapshot = getJson(rev, c1 + "/versions/2");
        assertThat(snapshot.path("payload").path("body").asString()).isEqualTo("검수자 수정");
        expect(200, lead, post(c1 + "/lock"), null);
        JsonNode stale = expect(409, lead, post(c1 + "/revisions"), revision(1, "옛 기준"));
        assertThat(stale.path("code").asString()).isEqualTo("VERSION_CONFLICT");
        expect(409, rev, delete(c1 + "/lock"), null); // someone else's valid lock
        expect(204, lead, delete(c1 + "/lock"), null);
        expect(204, lead, delete(c1 + "/lock"), null); // nothing to release
        assertThat(content(lead, id, "C1").path("lock").isNull()).isTrue();

        // ---- idle lock: taken over after 30 minutes, automatic release logged (system actor)
        String c2 = "/api/requests/" + id + "/contents/C2";
        expect(200, rev, post(c2 + "/lock"), null);
        ageLock(id, "C2");
        assertThat(content(lead, id, "C2").path("lock").isNull()).isTrue(); // expired locks are not shown
        expect(200, lead, post(c2 + "/lock"), null);
        JsonNode auto = last(id, "편집 잠금 자동 해제");
        assertThat(auto.path("detail").asString()).isEqualTo("사용자 rev: 30분간 입력 없음");
        assertThat(auto.path("actorId").isNull()).isTrue();
        assertThat(auto.path("contentKey").asString()).isEqualTo("C2");
        // ---- the release job clears idle locks
        ageLock(id, "C2");
        assertThat(lockService.releaseExpired()).isGreaterThanOrEqualTo(1);
        assertThat(last(id, "편집 잠금 자동 해제").path("detail").asString()).isEqualTo("사용자 lead: 30분간 입력 없음");
        assertThat(jdbc.queryForObject("SELECT lock_user_id FROM contents WHERE request_id = ? AND content_key = 'C2'",
                Long.class, id)).isNull();

        // ---- forced release: lead (history + holder notified), customer admin (audited), not the requester
        expect(200, rev, post(c1 + "/lock"), null);
        expect(409, req, post(c1 + "/lock/force-release"), null);
        expect(204, lead, post(c1 + "/lock/force-release"), null);
        assertThat(last(id, "편집 잠금 해제").path("detail").asString()).isEqualTo("사용자 rev님의 잠금");
        assertThat(recipients(id, "검수 시나리오 C1 콘텐츠 1: 사용자 lead님이 편집 잠금을 해제했습니다")).containsExactly(revId);
        expect(200, rev, post(c1 + "/lock"), null);
        Login admin = login(t.admin());
        expect(204, admin, post(c1 + "/lock/force-release"), null);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE target = ? AND action = '편집 잠금 해제'",
                Integer.class, id)).isEqualTo(1);

        // ---- opinion
        String opinions = "/api/requests/" + id + "/opinions";
        expect(409, req, post(opinions), Map.of("contentKey", "C1", "body", "x", "rowVersion", rowVersion(req, id)));
        assertThat(expect(400, rev, post(opinions), Map.of("body", " ", "rowVersion", rowVersion(rev, id)))
                .path("message").asString()).isEqualTo("의견을 입력하세요");
        JsonNode withOpinion = expect(200, rev, post(opinions), Map.of("contentKey", "C1", "body", "표현을 다듬었습니다",
                "rowVersion", rowVersion(rev, id)));
        assertThat(withOpinion.path("opinions")).hasSize(1);
        assertThat(withOpinion.path("opinions").get(0).path("round").asInt()).isEqualTo(1);
        assertThat(withOpinion.path("opinions").get(0).path("contentKey").asString()).isEqualTo("C1");
        assertThat(last(id, "검수 의견").path("detail").asString()).isEqualTo("표현을 다듬었습니다");

        // ---- ask: reviewer locks are released and logged; the requester is notified with the target
        expect(200, rev, post(c2 + "/lock"), null);
        String asks = "/api/requests/" + id + "/asks";
        assertThat(expect(400, lead, post(asks), Map.of("question", "", "rowVersion", rowVersion(lead, id)))
                .path("message").asString()).isEqualTo("확인할 내용을 입력하세요");
        String question = "혜택 적용 기간이 이번 달 말일까지가 맞는지 확인 부탁드립니다. 종료일 기준";
        JsonNode confirming = expect(200, lead, post(asks), Map.of("contentKey", "C1", "question", question,
                "rowVersion", rowVersion(lead, id)));
        assertThat(confirming.path("status").asString()).isEqualTo("CONFIRMING");
        assertThat(confirming.path("asks")).hasSize(1);
        long askId = confirming.path("asks").get(0).path("id").asLong();
        assertThat(confirming.path("contents").get(1).path("lock").isNull()).isTrue();
        assertThat(last(id, "편집 잠금 해제").path("detail").asString()).isEqualTo("확인 요청 전환으로 사용자 rev님의 잠금 해제");
        assertThat(jdbc.queryForObject("SELECT text FROM notifications WHERE request_id = ? AND kind = 'ASK'",
                String.class, id)).isEqualTo("사용자 lead님이 확인을 요청했습니다 (C1 콘텐츠 1): " + question.substring(0, 30) + "…");
        JsonNode reqNotifications = getJson(req, "/api/notifications");
        assertThat(reqNotifications.path("items").get(0).path("kind").asString()).isEqualTo("ASK");
        assertThat(reqNotifications.path("items").get(0).path("pending").asBoolean()).isTrue();
        expect(409, rev, post(c1 + "/lock"), null); // reviewers do not edit while the requester answers
        expect(409, lead, put(url), Map.of("reviewerIds", List.of(revId), "reason", "r", "handover", "h",
                "rowVersion", rowVersion(lead, id))); // no reviewer change while confirming

        // ---- the requester revises while answering: version + 1, answer marked, rowVersion unchanged
        long rvBefore = rowVersion(req, id);
        expect(200, req, post(c1 + "/lock"), null);
        JsonNode answered = expect(200, req, post(c1 + "/revisions"), revision(2, "요청자 답변 반영"));
        assertThat(answered.path("version").asInt()).isEqualTo(3);
        assertThat(last(id, "문안 수정 (확인 응답 중)").path("detail").asString()).isEqualTo("v2 → v3");
        assertThat(jdbc.queryForObject("SELECT answer_changed FROM requests WHERE id = ?", Boolean.class, id)).isTrue();
        assertThat(rowVersion(req, id)).isEqualTo(rvBefore);

        // ---- answer: back in review, round 2, reviewers notified with the answer
        String answerUrl = asks + "/" + askId + "/answer";
        expect(409, rev, post(answerUrl), Map.of("answer", "x", "rowVersion", rvBefore));
        assertThat(expect(400, req, post(answerUrl), Map.of("answer", "", "rowVersion", rvBefore)).path("message")
                .asString()).isEqualTo("답변을 입력하세요");
        JsonNode back = expect(200, req, post(answerUrl), Map.of("answer", "말일까지 맞습니다", "rowVersion", rvBefore));
        assertThat(back.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(back.path("round").asInt()).isEqualTo(2);
        assertThat(back.path("asks").get(0).path("answer").asString()).isEqualTo("말일까지 맞습니다");
        assertThat(back.path("asks").get(0).path("answeredBy").asLong()).isEqualTo(reqId);
        JsonNode answerEntry = last(id, "확인 응답");
        assertThat(answerEntry.path("round").asInt()).isEqualTo(1);
        assertThat(answerEntry.path("contentKey").asString()).isEqualTo("C1");
        JsonNode restart = last(id, "재검수 시작");
        assertThat(restart.path("detail").asString()).isEqualTo("확인 응답의 문안 수정으로 2차 검수");
        assertThat(restart.path("round").asInt()).isEqualTo(2);
        assertThat(recipients(id, "사용자 req님이 답변했습니다. 검수가 다시 시작됩니다. 답변: 말일까지 맞습니다"))
                .containsExactlyInAnyOrder(revId, leadId);
        assertThat(jdbc.queryForObject("SELECT answer_changed FROM requests WHERE id = ?", Boolean.class, id)).isFalse();
        expect(409, req, post(answerUrl), Map.of("answer", "다시", "rowVersion", rowVersion(req, id)));

        // ---- a question answered without changing text keeps the round
        JsonNode second = expect(200, rev, post(asks), Map.of("question", "요청 전체 확인", "rowVersion",
                rowVersion(rev, id)));
        long askId2 = second.path("asks").get(1).path("id").asLong();
        assertThat(second.path("asks").get(1).path("contentKey").isNull()).isTrue();
        expect(200, req, post(c2 + "/lock"), null);
        expect(200, req, post(c2 + "/revisions"), revision(1, "본문 C2")); // same text: no version, no round
        JsonNode kept = expect(200, req, post(asks + "/" + askId2 + "/answer"), Map.of("answer", "설명만 드립니다",
                "rowVersion", rowVersion(req, id)));
        assertThat(kept.path("round").asInt()).isEqualTo(2);
        assertThat(count(id, "재검수 시작")).isEqualTo(1);
    }

    @Test
    void reviewerChangeRecallAndResubmit() throws Exception {
        Tenant t = newTenant();
        long rev2Id = addUser(t, "rev2", "REVIEWER");
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login rev2 = login(email(t, "rev2"));
        long reqId = req.userId();
        long leadId = lead.userId();
        long revId = rev.userId();
        String id = submitted(req, t, "회수 시나리오");
        assign(lead, id, List.of(revId, leadId), revId);
        String url = "/api/requests/" + id + "/assignment";

        // ---- change: validation and no-op
        expect(200, rev, post("/api/requests/" + id + "/contents/C2/lock"), null);
        Map<String, Object> noop = new LinkedHashMap<>(Map.of("reviewerIds", List.of(leadId, revId),
                "primaryReviewerId", revId, "reason", "재배치", "handover", "C1 확인 중", "rowVersion",
                rowVersion(lead, id)));
        assertThat(expect(400, lead, put(url), noop).path("message").asString()).isEqualTo("변경된 검수자나 주담당이 없습니다");
        Map<String, Object> change = new LinkedHashMap<>(noop);
        change.put("reviewerIds", List.of(leadId, rev2Id));
        change.put("primaryReviewerId", rev2Id);
        change.put("reason", "");
        assertThat(expect(400, lead, put(url), change).path("message").asString()).isEqualTo("변경 사유을(를) 입력하세요");
        change.put("reason", "휴가");
        change.put("handover", " ");
        assertThat(expect(400, lead, put(url), change).path("message").asString()).isEqualTo("인수인계 내용을(를) 입력하세요");
        change.put("handover", "C1 확인 중");
        expect(409, rev, put(url), change);

        // ---- change: structured record, removed reviewer's lock released and logged, recipients
        JsonNode changed = expect(200, lead, put(url), change);
        assertThat(changed.path("reviewerIds").toString()).isEqualTo("[" + leadId + "," + rev2Id + "]");
        assertThat(changed.path("primaryReviewerId").asLong()).isEqualTo(rev2Id);
        Map<String, Object> record = jdbc.queryForMap("SELECT actor_id, round, from_reviewer_ids, from_primary_id, "
                + "to_reviewer_ids, to_primary_id, reason, handover FROM request_assignment_changes WHERE request_id = ?",
                id);
        assertThat(((Number) record.get("actor_id")).longValue()).isEqualTo(leadId);
        assertThat(((Number) record.get("from_primary_id")).longValue()).isEqualTo(revId);
        assertThat(((Number) record.get("to_primary_id")).longValue()).isEqualTo(rev2Id);
        assertThat(json.readTree(record.get("from_reviewer_ids").toString()).toString())
                .isEqualTo("[" + revId + "," + leadId + "]");
        assertThat(json.readTree(record.get("to_reviewer_ids").toString()).toString())
                .isEqualTo("[" + leadId + "," + rev2Id + "]");
        assertThat(record.get("reason")).isEqualTo("휴가");
        assertThat(record.get("handover")).isEqualTo("C1 확인 중");
        assertThat(last(id, "검수자 변경").path("detail").asString()).isEqualTo(
                "사용자 rev, 사용자 lead (주담당 사용자 rev) → 사용자 lead, 사용자 rev2 (주담당 사용자 rev2)"
                        + "\n주담당 변경: 사용자 rev → 사용자 rev2\n사유: 휴가\n인수인계: C1 확인 중");
        assertThat(last(id, "편집 잠금 해제").path("detail").asString()).isEqualTo("검수자 변경으로 사용자 rev님의 잠금 해제");
        assertThat(content(lead, id, "C2").path("lock").isNull()).isTrue();
        assertThat(recipients(id, "검수 담당이 바뀌었습니다. 주담당 사용자 rev2. 인수인계: C1 확인 중"))
                .containsExactlyInAnyOrder(reqId, revId, rev2Id);
        assertThat(strings(getJson(rev, "/api/requests/" + id).path("allowedActions"))).doesNotContain("REVIEW");

        // ---- recall request: primary decides, others informed once
        String recall = "/api/requests/" + id + "/recall";
        assertThat(expect(400, req, post(recall), Map.of("reason", "", "rowVersion", rowVersion(req, id)))
                .path("message").asString()).isEqualTo("회수 사유을(를) 입력하세요");
        expect(409, rev2, post(recall), Map.of("reason", "x", "rowVersion", rowVersion(rev2, id)));
        JsonNode pending = expect(200, req, post(recall), Map.of("reason", "파일 교체", "rowVersion",
                rowVersion(req, id)));
        assertThat(pending.path("recallRequested").asBoolean()).isTrue();
        assertThat(pending.path("recall").path("reason").asString()).isEqualTo("파일 교체");
        assertThat(strings(pending.path("allowedActions"))).doesNotContain("RECALL");
        assertThat(jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND kind = 'RECALL'",
                Long.class, id)).containsExactly(rev2Id);
        assertThat(jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND text = ?",
                Long.class, id, "회수 요청 사유: 파일 교체")).containsExactly(leadId);
        expect(409, req, post(recall), Map.of("reason", "다시", "rowVersion", rowVersion(req, id)));
        JsonNode blocked = expect(409, lead, post("/api/requests/" + id + "/asks"), Map.of("question", "q",
                "rowVersion", rowVersion(lead, id)));
        assertThat(blocked.path("message").asString()).isEqualTo("회수 요청이 처리될 때까지 확인 요청을 보낼 수 없습니다");

        // ---- primary change while the recall is pending (notice mentions it); the new primary decides
        change.put("reviewerIds", List.of(leadId, rev2Id));
        change.put("primaryReviewerId", leadId);
        change.put("handover", "회수 처리 부탁");
        change.put("rowVersion", rowVersion(lead, id));
        expect(200, lead, put(url), change);
        assertThat(recipients(id, "검수 담당이 바뀌었습니다. 주담당 사용자 lead. 회수 요청 처리 대기 중입니다. 인수인계: 회수 처리 부탁"))
                .containsExactlyInAnyOrder(reqId, rev2Id);
        assertThat(strings(getJson(lead, "/api/requests/" + id).path("allowedActions"))).contains("DECIDE_RECALL")
                .doesNotContain("COMPLETE");

        // ---- reject
        String decision = recall + "/decision";
        expect(409, rev2, post(decision), Map.of("approve", false, "comment", "x", "rowVersion", rowVersion(rev2, id)));
        assertThat(expect(400, lead, post(decision), Map.of("approve", false, "comment", "",
                "rowVersion", rowVersion(lead, id))).path("message").asString()).isEqualTo("처리 의견을(를) 입력하세요");
        JsonNode rejected = expect(200, lead, post(decision), Map.of("approve", false, "comment", "이번 차수에서 반영",
                "rowVersion", rowVersion(lead, id)));
        assertThat(rejected.path("status").asString()).isEqualTo("IN_REVIEW");
        assertThat(rejected.path("recall").isNull()).isTrue();
        assertThat(last(id, "회수 거절").path("detail").asString()).isEqualTo(
                "사유: 파일 교체\n처리 의견: 이번 차수에서 반영\n기존 배정: 사용자 lead, 사용자 rev2, 주담당 사용자 lead (유지)");
        assertThat(recipients(id, "회수 요청이 거절되었습니다. 이번 차수에서 반영")).containsExactlyInAnyOrder(reqId, rev2Id);

        // ---- recall again → approve: draft, assignment cleared, locks released, resubmit opens round 2
        expect(200, req, post(recall), Map.of("reason", "법무 최종본 반영", "rowVersion", rowVersion(req, id)));
        expect(200, rev2, post("/api/requests/" + id + "/contents/C1/lock"), null);
        JsonNode approved = expect(200, lead, post(decision), Map.of("approve", true, "comment", "회수 승인합니다",
                "rowVersion", rowVersion(lead, id)));
        assertThat(approved.path("status").asString()).isEqualTo("DRAFT");
        assertThat(approved.path("reviewerIds")).isEmpty();
        assertThat(approved.path("primaryReviewerId").isNull()).isTrue();
        assertThat(approved.path("allowedActions")).isEmpty();
        assertThat(last(id, "회수 승인").path("detail").asString()).isEqualTo(
                "사유: 법무 최종본 반영\n처리 의견: 회수 승인합니다\n기존 배정: 사용자 lead, 사용자 rev2, 주담당 사용자 lead");
        assertThat(recipients(id, "회수 요청이 승인되었습니다. 회수 승인합니다")).containsExactlyInAnyOrder(reqId, rev2Id);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contents WHERE request_id = ? AND lock_user_id IS NOT NULL",
                Integer.class, id)).isZero();
        expect(403, lead, get("/api/requests/" + id), null);
        JsonNode draft = getJson(req, "/api/requests/" + id);
        assertThat(draft.path("round").asInt()).isEqualTo(1);
        assertThat(strings(draft.path("allowedActions"))).contains("SUBMIT", "EDIT_CONTENT");
        JsonNode resubmitted = expect(200, req, post("/api/requests/" + id + "/submit"),
                Map.of("rowVersion", draft.path("rowVersion").asLong()));
        assertThat(resubmitted.path("status").asString()).isEqualTo("WAITING");
        assertThat(resubmitted.path("round").asInt()).isEqualTo(2);
        JsonNode reassigned = assign(lead, id, List.of(rev2Id), null);
        assertThat(reassigned.path("primaryReviewerId").asLong()).isEqualTo(rev2Id); // single reviewer = primary
        assertThat(reassigned.path("round").asInt()).isEqualTo(2);
    }

    @Test
    void fileRevisionsAndAmountsAreCapturedByTheNextRevision() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "FREEFORM"))
                .path("id").asString();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", "첨부 검수");
        info.put("hopeDueDate", "2026-12-20");
        info.put("purpose", "약관");
        info.put("target", "회원");
        info.put("background", "개정");
        expect(200, req, patch("/api/requests/" + id), info);
        byte[] pdf = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        String c1 = "/api/requests/" + id + "/contents/C1";
        long fileId = read(upload(req, c1 + "/files", "약관.pdf", pdf, null)).path("id").asLong();
        expect(200, req, patch(c1 + "/files/" + fileId), Map.of("totalAmount", 10, "reviewAmount", 6));
        expect(200, req, post("/api/requests/" + id + "/submit"), Map.of("rowVersion", rowVersion(req, id)));
        assign(lead, id, List.of(rev.userId()), rev.userId());

        // a file revision keeps the content version; the next saved revision captures it in a new version
        byte[] revised = "%PDF-1.7 revised".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        assertThat(upload(rev, c1 + "/files/" + fileId + "/versions", "약관 v2.pdf", revised, null).getResponse()
                .getStatus()).isEqualTo(201);
        assertThat(content(rev, id, "C1").path("version").asInt()).isEqualTo(1);
        expect(200, rev, post(c1 + "/lock"), null);
        JsonNode v2 = expect(200, rev, post(c1 + "/revisions"), Map.of("baseVersion", 1,
                "payload", Map.of("title", "", "text", "")));
        assertThat(v2.path("version").asInt()).isEqualTo(2);
        JsonNode snapshot = getJson(rev, c1 + "/versions/2");
        assertThat(snapshot.path("files").get(0).path("version").asInt()).isEqualTo(2);
        assertThat(snapshot.path("files").get(0).path("name").asString()).isEqualTo("약관 v2.pdf");

        // amounts edited in the revision buffer
        expect(200, rev, post(c1 + "/lock"), null);
        JsonNode v3 = expect(200, rev, post(c1 + "/revisions"), Map.of("baseVersion", 2,
                "payload", Map.of("title", "", "text", ""),
                "files", List.of(Map.of("fileId", fileId, "totalAmount", 10, "reviewAmount", 8, "rangeNote", "1~8쪽"))));
        assertThat(v3.path("version").asInt()).isEqualTo(3);
        assertThat(v3.path("files").get(0).path("reviewAmount").asInt()).isEqualTo(8);
        assertThat(v3.path("files").get(0).path("rangeNote").asString()).isEqualTo("1~8쪽");
        expect(200, rev, post(c1 + "/lock"), null);
        assertThat(expect(400, rev, post(c1 + "/revisions"), Map.of("baseVersion", 3,
                "payload", Map.of("title", "", "text", ""),
                "files", List.of(Map.of("fileId", fileId + 999, "totalAmount", 1))))
                .path("fieldErrors").get(0).path("field").asString()).isEqualTo("files.0.fileId");
        // the draft-only PATCH stays closed in review
        expect(409, rev, patch(c1 + "/files/" + fileId), Map.of("totalAmount", 1));
    }

    @Test
    void scheduleChangesFollowTheDueDatePolicy() throws Exception {
        Tenant t = newTenant();
        long approverId = addUser(t, "appr", "APPROVER");
        Login req = login(t.requester());
        Login lead = login(t.lead());
        Login rev = login(t.reviewer());
        Login approver = login(email(t, "appr"));
        Login admin = login(t.admin());
        String id = submitted(req, t, "납기 시나리오");
        String url = "/api/requests/" + id + "/schedule";
        jdbc.update("INSERT INTO request_reminders (request_id, user_id, count, last_at, due_date_snapshot) "
                + "VALUES (?, ?, 2, ?, '2026-12-20')", id, lead.userId(), LocalDateTime.now(ZoneOffset.UTC));

        // ---- denials: requester and plain reviewer, missing reason or date
        expect(409, req, patch(url), Map.of("dueDate", "2026-12-18", "reason", "x", "rowVersion", rowVersion(req, id)));
        assertThat(expect(400, lead, patch(url), Map.of("dueDate", "2026-12-18", "rowVersion", rowVersion(lead, id)))
                .path("message").asString()).isEqualTo("변경 사유을(를) 입력하세요");
        assertThat(expect(400, lead, patch(url), Map.of("reason", "범위 확대", "rowVersion", rowVersion(lead, id)))
                .path("message").asString()).isEqualTo("확정 납기를 입력하세요");

        // ---- lead in WAITING: before/after logged, reminders reset, requester notified (DUE)
        JsonNode changed = expect(200, lead, patch(url), Map.of("dueDate", "2026-12-18", "urgency", "URGENT",
                "reason", "범위 확대", "rowVersion", rowVersion(lead, id)));
        assertThat(changed.path("dueDate").asString()).isEqualTo("2026-12-18");
        assertThat(changed.path("hopeDueDate").asString()).isEqualTo("2026-12-20");
        assertThat(changed.path("urgency").asString()).isEqualTo("URGENT");
        String detail = "확정 납기 2026-12-20 → 2026-12-18, 긴급도 보통 → 긴급\n사유: 범위 확대";
        assertThat(last(id, "납기 변경").path("detail").asString()).isEqualTo(detail);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM request_reminders WHERE request_id = ?", Integer.class, id))
                .isZero();
        assertThat(jdbc.queryForList("SELECT user_id FROM notifications WHERE request_id = ? AND kind = 'DUE'",
                Long.class, id)).containsExactly(req.userId());
        assertThat(jdbc.queryForObject("SELECT text FROM notifications WHERE request_id = ? AND kind = 'DUE'",
                String.class, id)).isEqualTo("납기 시나리오 납기 변경: " + detail);

        // ---- in review: approver and customer admin may change it (admin audited); reviewers notified
        assign(lead, id, List.of(rev.userId()), rev.userId());
        expect(409, rev, patch(url), Map.of("dueDate", "2026-12-19", "reason", "x", "rowVersion", rowVersion(rev, id)));
        expect(200, approver, patch(url), Map.of("dueDate", "2026-12-19", "reason", "승인 일정",
                "rowVersion", rowVersion(approver, id)));
        assertThat(recipients(id, "납기 시나리오 납기 변경: 확정 납기 2026-12-15 → 2026-12-19"))
                .containsExactlyInAnyOrder(req.userId(), lead.userId(), rev.userId());
        expect(200, admin, patch(url), Map.of("dueDate", "2026-12-21", "urgency", "NORMAL", "reason", "관리자 조정",
                "rowVersion", rowVersion(admin, id)));
        assertThat(jdbc.queryForObject("SELECT detail FROM audit_logs WHERE target = ? AND action = '납기 변경'",
                String.class, id)).isEqualTo("확정 납기 2026-12-19 → 2026-12-21, 긴급도 긴급 → 보통\n사유: 관리자 조정");

        // ---- approval waiting: only eligible approvers (approval customer)
        jdbc.update("UPDATE customers SET approval_enabled = 1 WHERE id = ?", t.customerId());
        jdbc.update("UPDATE requests SET status = 'APPROVAL_WAITING', row_version = row_version + 1 WHERE id = ?", id);
        expect(409, lead, patch(url), Map.of("dueDate", "2026-12-22", "reason", "x", "rowVersion", rowVersion(lead, id)));
        expect(409, admin, patch(url), Map.of("dueDate", "2026-12-22", "reason", "x",
                "rowVersion", rowVersion(admin, id)));
        assertThat(strings(getJson(approver, "/api/requests/" + id).path("allowedActions"))).contains("EDIT_DUE");
        expect(200, approver, patch(url), Map.of("dueDate", "2026-12-22", "reason", "승인 전 조정",
                "rowVersion", rowVersion(approver, id)));
        assertThat(approverId).isEqualTo(approver.userId());

        // ---- final: nobody
        jdbc.update("UPDATE requests SET status = 'APPROVED', row_version = row_version + 1 WHERE id = ?", id);
        expect(409, approver, patch(url), Map.of("dueDate", "2026-12-23", "reason", "x",
                "rowVersion", rowVersion(approver, id)));
    }
}
