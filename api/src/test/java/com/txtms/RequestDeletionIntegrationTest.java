package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** A requester deletes a draft created by mistake: only one that was never submitted (contract §21). */
class RequestDeletionIntegrationTest extends IntegrationTestBase {

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private String freeformDraft(Login req, long projectId) throws Exception {
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", projectId, "type", "FREEFORM"))
                .path("id").asString();
        expect(200, req, patch("/api/requests/" + id), Map.of("title", "잘못 만든 요청"));
        return id;
    }

    @Test
    void theAuthorDeletesANeverSubmittedDraftWithItsRows() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = freeformDraft(req, t.projectId());
        assertThat(upload(req, "/api/requests/" + id + "/contents/C1/files", "a.pdf",
                RequestAuthoringIntegrationTest.PDF, null).getResponse().getStatus()).isEqualTo(201);
        JsonNode detail = getJson(req, "/api/requests/" + id);
        assertThat(detail.path("allowedActions").toString()).contains("\"DELETE\"");

        // nobody else may delete it: project members get the draft-private refusal, outsiders NOT_FOUND
        assertThat(expect(403, login(t.lead()), delete("/api/requests/" + id), null).path("code").asString())
                .isEqualTo("DRAFT_PRIVATE");
        expect(404, login(JUNG_OPERATOR), delete("/api/requests/" + id), null);

        expect(204, req, delete("/api/requests/" + id), null);
        expect(404, req, get("/api/requests/" + id), null);
        assertThat(count("SELECT COUNT(*) FROM requests WHERE id = ?", id)).isZero();
        assertThat(count("SELECT COUNT(*) FROM contents WHERE request_id = ?", id)).isZero();
        assertThat(count("SELECT COUNT(*) FROM request_history WHERE request_id = ?", id)).isZero();
        assertThat(count("SELECT COUNT(*) FROM audit_logs WHERE action = '요청 삭제' AND target = ? AND detail = ?",
                id, "잘못 만든 요청")).isEqualTo(1);
        expect(404, req, delete("/api/requests/" + id), null);
    }

    @Test
    void aSubmittedOrOnceSubmittedRequestIsNotDeleted() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "SMS"))
                .path("id").asString();
        // submitted (waiting for assignment): no DELETE
        jdbc.update("UPDATE requests SET status = 'WAITING', submitted_at = UTC_TIMESTAMP(6) WHERE id = ?", id);
        assertThat(getJson(req, "/api/requests/" + id).path("allowedActions").toString()).doesNotContain("DELETE");
        assertThat(expect(409, req, delete("/api/requests/" + id), null).path("code").asString())
                .isEqualTo("REQUEST_STATE_CONFLICT");
        // back to a draft after a cancel: the workflow history stays, so no DELETE either
        jdbc.update("UPDATE requests SET status = 'DRAFT', cancelled = 1 WHERE id = ?", id);
        assertThat(getJson(req, "/api/requests/" + id).path("allowedActions").toString()).doesNotContain("DELETE");
        expect(409, req, delete("/api/requests/" + id), null);
        assertThat(count("SELECT COUNT(*) FROM requests WHERE id = ?", id)).isEqualTo(1);
    }
}
