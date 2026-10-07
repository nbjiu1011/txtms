package com.txtms.domain.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.user.service.DeactivationRules.Facts;
import com.txtms.domain.user.service.DeactivationRules.Substitute;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Deactivation rule matrix (actions.md §10 #16). */
class DeactivationRulesTest {

    private static final Substitute OK = new Substitute(true, false);

    private static Facts facts(boolean self, boolean active, boolean lastAdmin, List<String> blocking,
            List<String> requesting, List<String> lastApprover, boolean needsSubstitute, Substitute substitute,
            boolean handover) {
        return new Facts(self, active, lastAdmin, blocking, requesting, lastApprover, needsSubstitute, substitute,
                handover);
    }

    private static Facts clean() {
        return facts(false, true, false, List.of(), List.of(), List.of(), false, null, false);
    }

    private static BusinessException fail(Facts f) {
        return catchThrowableOfType(BusinessException.class, () -> DeactivationRules.check(f));
    }

    @Test
    void nothingAffectedPassesWithoutSubstitute() {
        assertThatCode(() -> DeactivationRules.check(clean())).doesNotThrowAnyException();
    }

    @Test
    void selfInactiveAndLastAdminAreRefused() {
        assertThat(fail(facts(true, true, false, List.of(), List.of(), List.of(), false, null, false)).getMessage())
                .isEqualTo(DeactivationRules.SELF);
        assertThat(fail(facts(false, false, false, List.of(), List.of(), List.of(), false, null, false))
                .getMessage()).isEqualTo(DeactivationRules.NOT_ACTIVE);
        BusinessException lastAdmin = fail(facts(false, true, true, List.of(), List.of(), List.of(), false, null,
                false));
        assertThat(lastAdmin.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT);
        assertThat(lastAdmin.getMessage()).isEqualTo(DeactivationRules.LAST_ADMIN);
    }

    @Test
    void confirmingOrApprovalAssignmentsBlockWithTheIds() {
        BusinessException e = fail(facts(false, true, false, List.of("REQ-1", "REQ-2"), List.of(), List.of(), true,
                OK, true));
        assertThat(e.getMessage()).isEqualTo(DeactivationRules.BLOCKED_REVIEW);
        assertThat(e.getDetails()).containsExactly("REQ-1", "REQ-2");
    }

    @Test
    void ownRequestsInProgressBlock() {
        BusinessException e = fail(facts(false, true, false, List.of(), List.of("REQ-3"), List.of(), false, null,
                false));
        assertThat(e.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT);
        assertThat(e.getMessage()).startsWith("요청자로 진행 중인 요청이 1건 있습니다");
        assertThat(e.getDetails()).containsExactly("REQ-3");
    }

    @Test
    void lastApproverBlocksWithTheProjectNames() {
        BusinessException e = fail(facts(false, true, false, List.of(), List.of(), List.of("카드 혜택"), false, null,
                false));
        assertThat(e.getMessage()).isEqualTo(DeactivationRules.LAST_APPROVER);
        assertThat(e.getDetails()).containsExactly("카드 혜택");
    }

    @Test
    void handoverNeedsAValidSubstituteAndNote() {
        assertThat(fail(facts(false, true, false, List.of(), List.of(), List.of(), true, null, true)).getMessage())
                .isEqualTo("대체자을(를) 입력하세요");
        assertThat(fail(facts(false, true, false, List.of(), List.of(), List.of(), true, OK, false)).getMessage())
                .isEqualTo("인수인계 내용을(를) 입력하세요");
        BusinessException invalid = fail(facts(false, true, false, List.of(), List.of(), List.of(), true,
                new Substitute(false, false), true));
        assertThat(invalid.getCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
        assertThat(invalid.getMessage()).isEqualTo(DeactivationRules.SUBSTITUTE_INVALID);
        assertThat(fail(facts(false, true, false, List.of(), List.of(), List.of(), true, new Substitute(true, true),
                true)).getMessage()).isEqualTo(DeactivationRules.SUBSTITUTE_REQUESTER);
        assertThatCode(() -> DeactivationRules.check(facts(false, true, false, List.of(), List.of(), List.of(), true,
                OK, true))).doesNotThrowAnyException();
    }

    @Test
    void stateChecksComeBeforeTheSubstitute() {
        assertThat(fail(facts(false, true, false, List.of("REQ-1"), List.of("REQ-2"), List.of("P"), true, null,
                false)).getMessage()).isEqualTo(DeactivationRules.BLOCKED_REVIEW);
        assertThat(fail(facts(true, false, true, List.of("REQ-1"), List.of(), List.of(), true, null, false))
                .getMessage()).isEqualTo(DeactivationRules.SELF);
    }
}
