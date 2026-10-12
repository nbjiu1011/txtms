package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/**
 * RCS is deferred from Phase 1 (client decision 2026-10-12, contract §17.2): never listed, managed, guided, seeded or
 * created anew, while an existing RCS request stays readable.
 */
class RcsDeferralIntegrationTest extends IntegrationTestBase {

    private static final String DEFERRED = "RCS 유형은 1차에서 제공하지 않습니다";

    private static List<String> types(JsonNode list) {
        List<String> out = new ArrayList<>();
        list.forEach(t -> out.add(t.path("type").asString()));
        return out;
    }

    @Test
    void rcsIsNeitherListedNorManagedNorGuided() throws Exception {
        Login req = login(KIM_REQUESTER);
        Login operator = login(JUNG_OPERATOR);
        assertThat(types(getJson(req, "/api/content-types"))).containsExactly("ALIMTALK", "SMS", "FREEFORM");
        assertThat(types(getJson(operator, "/api/ops/content-types"))).containsExactly("ALIMTALK", "SMS", "FREEFORM");
        expect(404, operator, patch("/api/ops/content-types/RCS"), Map.of("active", true));
        expect(404, req, get("/api/guides/RCS"), null);
        assertThat(getJson(req, "/api/guides/SMS").path("checklist")).isNotEmpty();
        // the baseline migration keeps RCS switched off
        assertThat(jdbc.queryForObject("SELECT active FROM content_types WHERE type = 'RCS'", Boolean.class)).isFalse();
    }

    @Test
    void noNewRcsRequestDatasetOrAssignment() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        Login operator = login(JUNG_OPERATOR);
        assertThat(expect(400, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "RCS"))
                .path("message").asString()).isEqualTo("사용 중인 유형만 선택할 수 있습니다");

        JsonNode dataset = expect(400, operator, post("/api/ops/datasets"), Map.of("scope", "RCS", "rules",
                List.of(Map.of("ruleId", "R1", "originalExpr", "자세히보기", "recommendedExpr", "자세히 보기"))));
        assertThat(dataset.path("message").asString()).isEqualTo(DEFERRED);
        long alimtalk = jdbc.queryForObject(
                "SELECT id FROM datasets WHERE scope = 'ALIMTALK' ORDER BY version DESC LIMIT 1", Long.class);
        String assign = "/api/ops/customers/" + t.customerId() + "/dataset-assignments/RCS";
        assertThat(expect(400, operator, put(assign), Map.of("datasetId", alimtalk)).path("message").asString())
                .isEqualTo(DEFERRED);
        expect(400, operator, post(assign + "/confirm"), null);
        List<String> scopes = new ArrayList<>();
        getJson(operator, "/api/ops/datasets").forEach(d -> scopes.add(d.path("scope").asString()));
        assertThat(scopes).doesNotContain("RCS");
        getJson(operator, "/api/ops/dataset-assignments")
                .forEach(a -> assertThat(a.path("type").asString()).isNotEqualTo("RCS"));
        // the operator overview counts unassigned Phase 1 types only
        assertThat(getJson(operator, "/api/ops/customers/" + t.customerId()).path("unassignedDatasetTypes")
                .toString()).doesNotContain("RCS");
    }

    @Test
    void anExistingRcsRequestStaysReadableButIsNotCopied() throws Exception {
        Tenant t = newTenant();
        Login req = login(t.requester());
        String id = expect(201, req, post("/api/requests"), Map.of("projectId", t.projectId(), "type", "ALIMTALK"))
                .path("id").asString();
        // an RCS request created before the deferral
        jdbc.update("UPDATE requests SET content_type = 'RCS' WHERE id = ?", id);
        assertThat(getJson(req, "/api/requests/" + id).path("type").asString()).isEqualTo("RCS");
        assertThat(expect(400, req, post("/api/requests/" + id + "/clone"), null).path("message").asString())
                .isEqualTo(DEFERRED);
    }
}
