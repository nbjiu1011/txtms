package com.txtms.domain.request.policy;

import static com.txtms.domain.request.policy.PolicyFixtures.APPROVER;
import static com.txtms.domain.request.policy.PolicyFixtures.CUSTOMER;
import static com.txtms.domain.request.policy.PolicyFixtures.LEAD;
import static com.txtms.domain.request.policy.PolicyFixtures.PROJECT;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER;
import static com.txtms.domain.request.policy.PolicyFixtures.REVIEWER;
import static com.txtms.domain.request.policy.PolicyFixtures.actor;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.request.entity.RequestStatus;

/** Eligible approvers of a request and the completion/approval actions that depend on them. */
class EligibleApproversTest {

    private final RequestPolicy policy = new RequestPolicy();

    private static final long APPROVER_2 = 7;
    private static final long APPROVER_REVIEWER = 8;

    /** Approval project with three approvers; one of them is also a reviewer of the project. */
    private static ProjectFacts project(boolean approval, Set<Long> active) {
        Map<Long, Set<ProjectRole>> roles = Map.of(
                REQUESTER, EnumSet.of(ProjectRole.REQUESTER),
                REVIEWER, EnumSet.of(ProjectRole.REVIEWER),
                LEAD, EnumSet.of(ProjectRole.REVIEWER),
                APPROVER, EnumSet.of(ProjectRole.APPROVER),
                APPROVER_2, EnumSet.of(ProjectRole.APPROVER),
                APPROVER_REVIEWER, EnumSet.of(ProjectRole.APPROVER, ProjectRole.REVIEWER));
        return new ProjectFacts(PROJECT, CUSTOMER, "프로젝트", true, true, approval, 3, LEAD, roles, active);
    }

    private static RequestFacts request(RequestStatus status, List<Long> reviewers, Long primary) {
        return new RequestFacts("REQ-1", PROJECT, status, REQUESTER, reviewers, primary, false,
                LocalDate.of(2026, 10, 9), status != RequestStatus.DRAFT);
    }

    private static final Set<Long> ALL_ACTIVE = Set.of(REQUESTER, REVIEWER, LEAD, APPROVER, APPROVER_2,
            APPROVER_REVIEWER);

    @Test
    void activeApproversMinusRequesterAssignedReviewersAndPrimary() {
        RequestFacts r = request(RequestStatus.IN_REVIEW, List.of(REVIEWER, APPROVER_REVIEWER), REVIEWER);
        assertThat(policy.eligibleApprovers(project(true, ALL_ACTIVE), r)).containsExactly(APPROVER, APPROVER_2);
        RequestFacts notAssigned = request(RequestStatus.IN_REVIEW, List.of(REVIEWER), REVIEWER);
        assertThat(policy.eligibleApprovers(project(true, ALL_ACTIVE), notAssigned))
                .containsExactly(APPROVER, APPROVER_2, APPROVER_REVIEWER);
    }

    @Test
    void inactiveApproversAndApprovalDisabledCustomersHaveNone() {
        RequestFacts r = request(RequestStatus.IN_REVIEW, List.of(REVIEWER, APPROVER_REVIEWER), REVIEWER);
        assertThat(policy.eligibleApprovers(project(true, Set.of(REQUESTER, REVIEWER, LEAD, APPROVER_REVIEWER)), r))
                .isEmpty();
        assertThat(policy.eligibleApprovers(project(false, ALL_ACTIVE), r)).isEmpty();
    }

    @Test
    void approvalActionsAndDueEditInApprovalWaitingAreForEligibleApproversOnly() {
        ProjectFacts p = project(true, ALL_ACTIVE);
        RequestFacts waiting = request(RequestStatus.APPROVAL_WAITING, List.of(REVIEWER, APPROVER_REVIEWER),
                REVIEWER);
        assertThat(policy.allowedActions(actor(APPROVER_2), p, waiting)).contains(RequestAction.APPROVE,
                RequestAction.REVISE, RequestAction.EDIT_DUE);
        assertThat(policy.allowedActions(actor(APPROVER_REVIEWER), p, waiting)).doesNotContain(RequestAction.APPROVE,
                RequestAction.REVISE, RequestAction.EDIT_DUE);
        assertThat(policy.allowedActions(actor(LEAD), p, waiting)).doesNotContain(RequestAction.EDIT_DUE,
                RequestAction.APPROVE);
        assertThat(policy.allowedActions(actor(REVIEWER), p, waiting)).doesNotContain(RequestAction.COMPLETE,
                RequestAction.EDIT_CONTENT, RequestAction.REVIEW);
    }

    @Test
    void nothingButExportCloneAndFollowUpAfterFinalCompletion() {
        ProjectFacts p = project(true, ALL_ACTIVE);
        for (RequestStatus s : List.of(RequestStatus.APPROVED, RequestStatus.REVIEW_COMPLETED)) {
            RequestFacts done = request(s, List.of(REVIEWER), REVIEWER);
            assertThat(policy.allowedActions(actor(REQUESTER), p, done)).containsExactlyInAnyOrder(
                    RequestAction.EXPORT, RequestAction.CLONE, RequestAction.FOLLOW_UP);
            assertThat(policy.allowedActions(actor(REVIEWER), p, done)).containsExactly(RequestAction.EXPORT);
            assertThat(policy.allowedActions(actor(LEAD), p, done)).containsExactly(RequestAction.EXPORT);
            assertThat(policy.allowedActions(actor(APPROVER), p, done)).containsExactly(RequestAction.EXPORT);
        }
    }
}
