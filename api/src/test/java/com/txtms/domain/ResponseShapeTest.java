package com.txtms.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.mail.MailKind;
import com.txtms.domain.mail.OutboundEmail;
import com.txtms.domain.mail.OutboxService.OutboxMail;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.user.dto.UserSummary;
import com.txtms.domain.variable.dto.ProjectVariableLogResponse;
import com.txtms.domain.variable.dto.VariableResponse;
import com.txtms.domain.variable.entity.VariableType;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** JSON keys of the admin listing additions: optional, nullable and always-present fields. */
class ResponseShapeTest {

    private static final Instant AT = Instant.parse("2026-10-07T01:02:03Z");

    private final JsonMapper json = JsonMapper.builder().build();

    private JsonNode tree(Object value) {
        return json.readTree(json.writeValueAsString(value));
    }

    private static ProjectResponse project(Long activeRequestCount) {
        return new ProjectResponse(4, 1, "카드 혜택 알림", true, 3L, List.of(), List.of("1588-0000"), List.of(), 2,
                activeRequestCount);
    }

    @Test
    void activeRequestCountIsLeftOutUnlessGiven() {
        assertThat(tree(project(null)).has("activeRequestCount")).isFalse();
        JsonNode counted = tree(project(0L));
        assertThat(counted.has("activeRequestCount")).isTrue();
        assertThat(counted.path("activeRequestCount").asLong()).isZero();
        assertThat(tree(project(7L)).path("activeRequestCount").asLong()).isEqualTo(7);
        // the other nullable key keeps its explicit null
        JsonNode noLead = tree(new ProjectResponse(4, 1, "p", true, null, List.of(), List.of(), List.of(), 0, null));
        assertThat(noLead.has("leadUserId")).isTrue();
        assertThat(noLead.path("leadUserId").isNull()).isTrue();
    }

    @Test
    void userSummaryKeepsANullDept() {
        JsonNode pending = tree(new UserSummary(9, "손님", null, "guest@a.kr", false, "#6A6F7A"));
        assertThat(pending.has("dept")).isTrue();
        assertThat(pending.path("dept").isNull()).isTrue();
    }

    @Test
    void variableCarriesTheDeletedFlag() {
        JsonNode deleted = tree(new VariableResponse(7, 1, "points", "", VariableType.NUMBER, "1", false, false, 3L, AT,
                AT, true));
        assertThat(deleted.path("deleted").asBoolean()).isTrue();
        JsonNode live = tree(new VariableResponse(8, 1, "name", "", VariableType.TEXT, "a", true, true, 3L, AT, AT,
                false));
        assertThat(live.has("deleted")).isTrue();
        assertThat(live.path("deleted").asBoolean()).isFalse();
    }

    @Test
    void projectVariableLogEmbedsTheSnapshotsAndTheActorName() {
        JsonNode created = tree(new ProjectVariableLogResponse(7, AT, 3L, "이도현", "등록", null,
                "{\"key\":\"points\",\"type\":\"NUMBER\",\"value\":\"1\",\"active\":true}"));
        assertThat(created.path("variableId").asLong()).isEqualTo(7);
        assertThat(created.path("actorName").asString()).isEqualTo("이도현");
        assertThat(created.path("before").isNull()).isTrue();
        assertThat(created.path("after").path("key").asString()).isEqualTo("points");
        assertThat(created.path("after").path("active").asBoolean()).isTrue();
        JsonNode unknownActor = tree(new ProjectVariableLogResponse(7, AT, null, null, "변경", "{}", "{}"));
        assertThat(unknownActor.has("actorName")).isTrue();
        assertThat(unknownActor.path("actorName").isNull()).isTrue();
    }

    @Test
    void outboxMailCarriesItsKind() {
        JsonNode mail = tree(new OutboxMail(1, 2L, "a@b.kr", "TX TMS 초대", "본문", AT, "PENDING", true,
                MailKind.INVITATION));
        assertThat(mail.path("kind").asString()).isEqualTo("INVITATION");
        assertThat(new OutboundEmail(MailKind.REMINDER, 2L, "a@b.kr", "s", "b", AT).getKind())
                .isEqualTo(MailKind.REMINDER);
        assertThat(new OutboundEmail(null, 2L, "a@b.kr", "s", "b", AT).getKind()).isEqualTo(MailKind.OTHER);
    }
}
