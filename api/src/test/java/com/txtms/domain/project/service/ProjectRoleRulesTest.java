package com.txtms.domain.project.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectRoleRules.Facts;

/** Role editing rules of the customer admin. */
class ProjectRoleRulesTest {

    private static final Set<ProjectRole> NONE = EnumSet.noneOf(ProjectRole.class);
    private static final Set<ProjectRole> REQ = EnumSet.of(ProjectRole.REQUESTER);
    private static final Set<ProjectRole> REV = EnumSet.of(ProjectRole.REVIEWER);
    private static final Set<ProjectRole> APPR = EnumSet.of(ProjectRole.APPROVER);

    private static Facts facts(boolean approval, boolean lead, boolean assigned, boolean onlyApprover) {
        return new Facts("카드", approval, lead, assigned, false, onlyApprover);
    }

    @Test
    void requesterAndReviewerAreExclusive() {
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), NONE,
                EnumSet.of(ProjectRole.REQUESTER, ProjectRole.REVIEWER))).isEqualTo(ProjectRoleRules.EXCLUSIVE);
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), REV, REQ)).isNull();
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), NONE,
                EnumSet.of(ProjectRole.REQUESTER, ProjectRole.APPROVER))).isNull();
    }

    @Test
    void approverNeedsApprovalCustomer() {
        assertThat(ProjectRoleRules.problem(facts(false, false, false, false), NONE, APPR))
                .isEqualTo(ProjectRoleRules.APPROVAL_NOT_USED);
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), NONE, APPR)).isNull();
    }

    @Test
    void leadKeepsTheReviewerRole() {
        assertThat(ProjectRoleRules.problem(facts(true, true, false, false), REV, NONE))
                .startsWith("카드: 대표 검수자의 검수자 역할은 해제할 수 없습니다");
        assertThat(ProjectRoleRules.problem(facts(true, true, false, false), REV, REQ))
                .startsWith("카드: 대표 검수자의");
        assertThat(ProjectRoleRules.problem(facts(true, true, false, false), REV,
                EnumSet.of(ProjectRole.REVIEWER, ProjectRole.APPROVER))).isNull();
    }

    @Test
    void reviewerInAnUnfinishedReviewKeepsTheRole() {
        assertThat(ProjectRoleRules.problem(facts(true, false, true, false), REV, NONE))
                .isEqualTo("카드: 진행 중인 검수가 있어 검수자 역할을 해제할 수 없습니다. 먼저 검수자를 변경하세요");
        assertThat(ProjectRoleRules.problem(facts(true, false, true, false), REV,
                EnumSet.of(ProjectRole.REVIEWER, ProjectRole.APPROVER))).isNull();
    }

    @Test
    void requesterOfARequestInProgressKeepsTheRole() {
        Facts requesting = new Facts("카드", true, false, false, true, false);
        assertThat(ProjectRoleRules.problem(requesting, REQ, NONE)).isEqualTo(
                "카드: 진행 중인 요청의 요청자라 요청자 역할을 해제할 수 없습니다. 요청을 완료하거나 취소한 뒤 해제하세요");
        assertThat(ProjectRoleRules.problem(requesting, REQ, EnumSet.of(ProjectRole.REQUESTER, ProjectRole.APPROVER)))
                .isNull();
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), REQ, NONE)).isNull();
    }

    @Test
    void lastActiveApproverStays() {
        assertThat(ProjectRoleRules.problem(facts(true, false, false, true), APPR, NONE))
                .isEqualTo("카드: 마지막 승인자라 해제할 수 없습니다");
        assertThat(ProjectRoleRules.problem(facts(true, false, false, false), APPR, NONE)).isNull();
    }

    @Test
    void labels() {
        assertThat(ProjectRoleRules.label(NONE)).isEqualTo("없음");
        assertThat(ProjectRoleRules.label(EnumSet.of(ProjectRole.APPROVER, ProjectRole.REQUESTER)))
                .isEqualTo("요청자, 승인자");
    }
}
