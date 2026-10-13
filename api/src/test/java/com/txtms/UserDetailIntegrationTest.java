package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.txtms.support.IntegrationTestBase;

import tools.jackson.databind.JsonNode;

/** 사용자 상세 (contract §25): one member, name and department, the customer admin right. */
class UserDetailIntegrationTest extends IntegrationTestBase {

    private int audits(String action, long customerId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = ? AND customer_id = ?",
                Integer.class, action, customerId);
    }

    private String lastAudit(String action, long customerId) {
        return jdbc.queryForObject("SELECT detail FROM audit_logs WHERE action = ? AND customer_id = ? "
                + "ORDER BY id DESC LIMIT 1", String.class, action, customerId);
    }

    @Test
    void adminReadsOneMemberAndEditsNameAndDepartment() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        long reviewerId = userId(t.reviewer());
        String url = "/api/customers/" + t.customerId() + "/users/" + reviewerId;

        JsonNode member = getJson(admin, url);
        assertThat(member.path("user").path("id").asLong()).isEqualTo(reviewerId);
        assertThat(member.path("projects").get(0).path("roles").get(0).asString()).isEqualTo("REVIEWER");
        assertThat(member.has("pendingEmail")).isTrue();
        expect(403, login(t.requester()), get(url), null);
        expect(404, login(KANG_ADMIN), get(url), null);
        expect(404, admin, get("/api/customers/" + t.customerId() + "/users/" + userId(KIM_REQUESTER)), null);

        assertThat(expect(400, admin, patch(url), Map.of("name", " ")).path("message").asString())
                .isEqualTo("이름을(를) 입력하세요");
        assertThat(expect(400, admin, patch(url), Map.of("dept", "가".repeat(101))).path("message").asString())
                .isEqualTo("소속은 최대 100자입니다");
        expect(403, login(t.requester()), patch(url), Map.of("name", "x"));

        JsonNode renamed = expect(200, admin, patch(url), Map.of("name", " 박검수 ", "dept", "검수2팀"));
        assertThat(renamed.path("user").path("name").asString()).isEqualTo("박검수");
        assertThat(renamed.path("user").path("dept").asString()).isEqualTo("검수2팀");
        assertThat(lastAudit("사용자 정보 변경", t.customerId()))
                .isEqualTo("이름 사용자 rev → 박검수 / 소속 테스트팀 → 검수2팀");
        // keys left out keep their value; an empty department clears it
        JsonNode cleared = expect(200, admin, patch(url), Map.of("dept", ""));
        assertThat(cleared.path("user").path("name").asString()).isEqualTo("박검수");
        assertThat(cleared.path("user").path("dept").isNull()).isTrue();
        assertThat(lastAudit("사용자 정보 변경", t.customerId())).isEqualTo("소속 검수2팀 → -");
        expect(200, admin, patch(url), Map.of("name", "박검수"));
        assertThat(audits("사용자 정보 변경", t.customerId())).isEqualTo(2);
    }

    @Test
    void adminGrantsAndRevokesTheCustomerAdminRight() throws Exception {
        Tenant t = newTenant();
        Login admin = login(t.admin());
        long adminId = userId(t.admin());
        long reviewerId = userId(t.reviewer());
        long requester2Id = userId(t.requester2());
        String base = "/api/customers/" + t.customerId() + "/users/";

        assertThat(expect(400, admin, put(base + reviewerId + "/admin"), new HashMap<>()).path("message")
                .asString()).isEqualTo("관리자 권한 여부를 선택하세요");
        expect(403, login(t.requester()), put(base + reviewerId + "/admin"), Map.of("admin", true));
        jdbc.update("UPDATE users SET active = 0 WHERE id = ?", requester2Id);
        assertThat(expect(409, admin, put(base + requester2Id + "/admin"), Map.of("admin", true)).path("message")
                .asString()).isEqualTo("활성 사용자만 관리자로 지정할 수 있습니다");
        assertThat(expect(409, admin, put(base + adminId + "/admin"), Map.of("admin", false)).path("message")
                .asString()).isEqualTo("본인의 관리자 권한은 해제할 수 없습니다");

        // granted: the reviewer can manage the customer now
        Login reviewer = login(t.reviewer());
        expect(403, reviewer, get("/api/customers/" + t.customerId() + "/members"), null);
        assertThat(expect(200, admin, put(base + reviewerId + "/admin"), Map.of("admin", true)).path("admin")
                .asBoolean()).isTrue();
        getJson(reviewer, "/api/customers/" + t.customerId() + "/members");
        assertThat(audits("관리자 권한 부여", t.customerId())).isEqualTo(1);
        // same value: nothing to do
        expect(200, admin, put(base + reviewerId + "/admin"), Map.of("admin", true));
        assertThat(audits("관리자 권한 부여", t.customerId())).isEqualTo(1);

        // the new admin revokes the first one, who loses access
        assertThat(expect(200, reviewer, put(base + adminId + "/admin"), Map.of("admin", false)).path("admin")
                .asBoolean()).isFalse();
        expect(403, admin, get("/api/customers/" + t.customerId() + "/members"), null);
        assertThat(audits("관리자 권한 해제", t.customerId())).isEqualTo(1);
    }
}
