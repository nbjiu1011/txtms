package com.txtms.domain.request.policy;

import static com.txtms.domain.request.policy.PolicyFixtures.ADMIN;
import static com.txtms.domain.request.policy.PolicyFixtures.APPROVER;
import static com.txtms.domain.request.policy.PolicyFixtures.INACTIVE_APPROVER;
import static com.txtms.domain.request.policy.PolicyFixtures.LEAD;
import static com.txtms.domain.request.policy.PolicyFixtures.OUTSIDER;
import static com.txtms.domain.request.policy.PolicyFixtures.PROJECT;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER_2;
import static com.txtms.domain.request.policy.PolicyFixtures.REVIEWER;
import static com.txtms.domain.request.policy.PolicyFixtures.actor;
import static com.txtms.domain.request.policy.PolicyFixtures.admin;
import static com.txtms.domain.request.policy.PolicyFixtures.project;
import static com.txtms.domain.request.policy.PolicyFixtures.request;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

class RequestPolicyTest {

    private final RequestPolicy policy = new RequestPolicy();
    private final ProjectFacts approvalProject = project(true);

    private Set<RequestAction> actions(Actor actor, RequestStatus status) {
        return policy.allowedActions(actor, approvalProject, request(status));
    }

    private Set<RequestAction> actions(Actor actor, RequestStatus status, boolean recall) {
        return policy.allowedActions(actor, approvalProject, request(status, recall));
    }

    @Nested
    class Visibility {

        @Test
        void membersAndCustomerAdminsSeeSubmittedRequests() {
            RequestFacts r = request(RequestStatus.IN_REVIEW);
            assertThat(policy.canView(actor(REQUESTER_2), approvalProject, r)).isTrue();
            assertThat(policy.canView(actor(APPROVER), approvalProject, r)).isTrue();
            assertThat(policy.canView(admin(), approvalProject, r)).isTrue();
        }

        @Test
        void draftIsVisibleToItsAuthorOnly() {
            RequestFacts draft = request(RequestStatus.DRAFT);
            assertThat(policy.canView(actor(REQUESTER), approvalProject, draft)).isTrue();
            assertThat(policy.canView(actor(REQUESTER_2), approvalProject, draft)).isFalse();
            assertThat(policy.canView(actor(LEAD), approvalProject, draft)).isFalse();
            assertThat(policy.canView(admin(), approvalProject, draft)).isFalse();
        }

        @Test
        void outsidersOperatorsAndOtherCustomerAdminsSeeNothing() {
            RequestFacts r = request(RequestStatus.IN_REVIEW);
            assertThat(policy.canView(actor(OUTSIDER), approvalProject, r)).isFalse();
            assertThat(policy.canView(PolicyFixtures.operator(), approvalProject, r)).isFalse();
            assertThat(policy.canView(PolicyFixtures.otherCustomerAdmin(), approvalProject, r)).isFalse();
            assertThat(policy.allowedActions(PolicyFixtures.operator(), approvalProject, r)).isEmpty();
        }

        @Test
        void inactiveUserOrCustomerSeesNothing() {
            RequestFacts r = request(RequestStatus.IN_REVIEW);
            assertThat(policy.canView(PolicyFixtures.inactive(REVIEWER), approvalProject, r)).isFalse();
            assertThat(policy.canView(actor(REVIEWER), project(true, false), r)).isFalse();
        }

        @Test
        void requestOfAnotherProjectIsNotVisible() {
            RequestFacts r = new RequestFacts("REQ-1", PROJECT + 1, RequestStatus.IN_REVIEW, REQUESTER,
                    List.of(REVIEWER), REVIEWER, false, null, true);
            assertThat(policy.canView(actor(REVIEWER), approvalProject, r)).isFalse();
        }
    }

    @Nested
    class Drafting {

        @Test
        void authorEditsSubmitsClonesAndDeletesANeverSubmittedDraft() {
            assertThat(actions(actor(REQUESTER), RequestStatus.DRAFT)).containsExactlyInAnyOrder(
                    RequestAction.EDIT_REQUEST, RequestAction.EDIT_CONTENT, RequestAction.SUBMIT, RequestAction.DELETE,
                    RequestAction.CLONE);
        }

        @Test
        void aDraftBackFromCancelOrRecallCannotBeDeleted() {
            RequestFacts returned = new RequestFacts("REQ-1", PROJECT, RequestStatus.DRAFT, REQUESTER, List.of(), null,
                    false, null, true);
            assertThat(policy.allowedActions(actor(REQUESTER), approvalProject, returned))
                    .contains(RequestAction.SUBMIT).doesNotContain(RequestAction.DELETE);
        }

        @Test
        void onlyTheAuthorDeletesAndOnlyADraft() {
            for (RequestStatus s : RequestStatus.values()) {
                if (s != RequestStatus.DRAFT) {
                    assertThat(actions(actor(REQUESTER), s)).doesNotContain(RequestAction.DELETE);
                }
            }
            assertThat(actions(actor(LEAD), RequestStatus.DRAFT)).doesNotContain(RequestAction.DELETE);
        }

        @Test
        void editRequestAndSubmitOnlyWhileDraft() {
            for (RequestStatus s : RequestStatus.values()) {
                if (s == RequestStatus.DRAFT) {
                    continue;
                }
                assertThat(actions(actor(REQUESTER), s))
                        .doesNotContain(RequestAction.EDIT_REQUEST, RequestAction.SUBMIT);
            }
        }

        @Test
        void cancelOnlyWhileWaitingByAuthor() {
            assertThat(actions(actor(REQUESTER), RequestStatus.WAITING)).contains(RequestAction.CANCEL);
            assertThat(actions(actor(REQUESTER_2), RequestStatus.WAITING)).doesNotContain(RequestAction.CANCEL);
            assertThat(actions(actor(REQUESTER), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.CANCEL);
        }

        @Test
        void cloneNeedsRequesterRoleInAnyState() {
            assertThat(actions(actor(REQUESTER_2), RequestStatus.IN_REVIEW)).contains(RequestAction.CLONE);
            assertThat(actions(actor(REQUESTER_2), RequestStatus.APPROVED)).contains(RequestAction.CLONE);
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.CLONE);
            assertThat(actions(admin(), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.CLONE);
        }

        @Test
        void followUpNeedsRequesterRoleAndFinalCompletion() {
            assertThat(actions(actor(REQUESTER), RequestStatus.APPROVED)).contains(RequestAction.FOLLOW_UP);
            assertThat(actions(actor(REQUESTER), RequestStatus.REVIEW_COMPLETED)).contains(RequestAction.FOLLOW_UP);
            assertThat(actions(actor(REQUESTER), RequestStatus.APPROVAL_WAITING))
                    .doesNotContain(RequestAction.FOLLOW_UP);
            assertThat(actions(actor(REVIEWER), RequestStatus.APPROVED)).doesNotContain(RequestAction.FOLLOW_UP);
        }
    }

    @Nested
    class Assignment {

        @Test
        void leadAssignsWaitingAndChangesInReview() {
            assertThat(actions(actor(LEAD), RequestStatus.WAITING)).contains(RequestAction.ASSIGN);
            assertThat(actions(actor(LEAD), RequestStatus.IN_REVIEW)).contains(RequestAction.CHANGE_ASSIGNMENT);
        }

        @Test
        void othersCannotAssignAndLeadCannotChangeOutsideReview() {
            assertThat(actions(actor(REVIEWER), RequestStatus.WAITING)).doesNotContain(RequestAction.ASSIGN);
            assertThat(actions(admin(), RequestStatus.WAITING)).doesNotContain(RequestAction.ASSIGN);
            assertThat(actions(actor(LEAD), RequestStatus.CONFIRMING))
                    .doesNotContain(RequestAction.CHANGE_ASSIGNMENT);
            assertThat(actions(actor(LEAD), RequestStatus.APPROVAL_WAITING))
                    .doesNotContain(RequestAction.CHANGE_ASSIGNMENT);
        }
    }

    @Nested
    class Review {

        @Test
        void assignedReviewersReviewAndEditInReview() {
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW))
                    .contains(RequestAction.REVIEW, RequestAction.EDIT_CONTENT);
            assertThat(actions(actor(LEAD), RequestStatus.IN_REVIEW))
                    .contains(RequestAction.REVIEW, RequestAction.EDIT_CONTENT);
        }

        @Test
        void unassignedUsersAndAdminsCannotReview() {
            assertThat(actions(actor(REQUESTER), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.REVIEW);
            assertThat(actions(admin(), RequestStatus.IN_REVIEW))
                    .doesNotContain(RequestAction.REVIEW, RequestAction.EDIT_CONTENT, RequestAction.COMPLETE);
            assertThat(actions(actor(REVIEWER), RequestStatus.CONFIRMING)).doesNotContain(RequestAction.REVIEW);
        }

        @Test
        void primaryCompletesUnlessRecallPending() {
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW)).contains(RequestAction.COMPLETE);
            assertThat(actions(actor(LEAD), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.COMPLETE);
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW, true))
                    .doesNotContain(RequestAction.COMPLETE);
        }

        @Test
        void requesterAnswersAndEditsWhileConfirming() {
            assertThat(actions(actor(REQUESTER), RequestStatus.CONFIRMING))
                    .contains(RequestAction.ANSWER, RequestAction.EDIT_CONTENT);
            assertThat(actions(actor(REQUESTER_2), RequestStatus.CONFIRMING)).doesNotContain(RequestAction.ANSWER);
            assertThat(actions(actor(REQUESTER), RequestStatus.IN_REVIEW))
                    .doesNotContain(RequestAction.ANSWER, RequestAction.EDIT_CONTENT);
        }

        @Test
        void noContentEditingWhileWaitingApprovalWaitingOrFinal() {
            for (RequestStatus s : List.of(RequestStatus.WAITING, RequestStatus.APPROVAL_WAITING,
                    RequestStatus.APPROVED, RequestStatus.REVIEW_COMPLETED)) {
                for (long user : List.of(REQUESTER, REVIEWER, LEAD, APPROVER)) {
                    assertThat(actions(actor(user), s)).doesNotContain(RequestAction.EDIT_CONTENT);
                }
            }
        }

        @Test
        void unlockForLeadAndAdminWhileContentCanBeLocked() {
            assertThat(actions(actor(LEAD), RequestStatus.IN_REVIEW)).contains(RequestAction.UNLOCK);
            assertThat(actions(admin(), RequestStatus.CONFIRMING)).contains(RequestAction.UNLOCK);
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.UNLOCK);
            assertThat(actions(actor(LEAD), RequestStatus.APPROVAL_WAITING)).doesNotContain(RequestAction.UNLOCK);
        }
    }

    @Nested
    class Recall {

        @Test
        void requesterRecallsInReviewOnce() {
            assertThat(actions(actor(REQUESTER), RequestStatus.IN_REVIEW)).contains(RequestAction.RECALL);
            assertThat(actions(actor(REQUESTER), RequestStatus.IN_REVIEW, true))
                    .doesNotContain(RequestAction.RECALL);
            assertThat(actions(actor(REQUESTER), RequestStatus.CONFIRMING)).doesNotContain(RequestAction.RECALL);
            assertThat(actions(actor(REQUESTER), RequestStatus.APPROVAL_WAITING))
                    .doesNotContain(RequestAction.RECALL);
            assertThat(actions(actor(REQUESTER_2), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.RECALL);
        }

        @Test
        void primaryDecidesPendingRecall() {
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW, true))
                    .contains(RequestAction.DECIDE_RECALL);
            assertThat(actions(actor(REVIEWER), RequestStatus.IN_REVIEW))
                    .doesNotContain(RequestAction.DECIDE_RECALL);
            assertThat(actions(actor(LEAD), RequestStatus.IN_REVIEW, true))
                    .doesNotContain(RequestAction.DECIDE_RECALL);
        }
    }

    @Nested
    class Approval {

        @Test
        void eligibleApproversExcludeRequesterReviewersPrimaryAndInactive() {
            ProjectFacts facts = project(true);
            RequestFacts r = new RequestFacts("REQ-1", PROJECT, RequestStatus.APPROVAL_WAITING, APPROVER,
                    List.of(REVIEWER), REVIEWER, false, null, true);
            assertThat(policy.eligibleApprovers(facts, r)).isEmpty();
            assertThat(policy.eligibleApprovers(facts, request(RequestStatus.APPROVAL_WAITING)))
                    .containsExactly(APPROVER)
                    .doesNotContain(INACTIVE_APPROVER);
        }

        @Test
        void eligibleApproverApprovesAndRevises() {
            assertThat(actions(actor(APPROVER), RequestStatus.APPROVAL_WAITING))
                    .contains(RequestAction.APPROVE, RequestAction.REVISE, RequestAction.EDIT_DUE);
        }

        @Test
        void nonEligibleUsersCannotApprove() {
            assertThat(actions(actor(INACTIVE_APPROVER), RequestStatus.APPROVAL_WAITING)).isEmpty();
            assertThat(actions(actor(REVIEWER), RequestStatus.APPROVAL_WAITING))
                    .doesNotContain(RequestAction.APPROVE, RequestAction.REVISE);
            assertThat(actions(admin(), RequestStatus.APPROVAL_WAITING))
                    .doesNotContain(RequestAction.APPROVE, RequestAction.REVISE, RequestAction.EDIT_DUE);
            assertThat(actions(actor(APPROVER), RequestStatus.IN_REVIEW)).doesNotContain(RequestAction.APPROVE);
        }

        @Test
        void noApprovalWithoutApprovalEnabledCustomer() {
            ProjectFacts noApproval = project(false);
            assertThat(policy.eligibleApprovers(noApproval, request(RequestStatus.APPROVAL_WAITING))).isEmpty();
            assertThat(policy.allowedActions(actor(APPROVER), noApproval, request(RequestStatus.APPROVAL_WAITING)))
                    .doesNotContain(RequestAction.APPROVE);
        }
    }

    @Nested
    class DueDates {

        @Test
        void adminLeadAndApproversEditDueBeforeApproval() {
            for (RequestStatus s : List.of(RequestStatus.WAITING, RequestStatus.IN_REVIEW, RequestStatus.CONFIRMING)) {
                assertThat(actions(admin(), s)).contains(RequestAction.EDIT_DUE);
                assertThat(actions(actor(LEAD), s)).contains(RequestAction.EDIT_DUE);
                assertThat(actions(actor(APPROVER), s)).contains(RequestAction.EDIT_DUE);
                assertThat(actions(actor(REVIEWER), s)).doesNotContain(RequestAction.EDIT_DUE);
                assertThat(actions(actor(REQUESTER), s)).doesNotContain(RequestAction.EDIT_DUE);
            }
        }

        @Test
        void onlyEligibleApproversEditDueWhileApprovalWaiting() {
            assertThat(actions(actor(LEAD), RequestStatus.APPROVAL_WAITING)).doesNotContain(RequestAction.EDIT_DUE);
            assertThat(actions(actor(APPROVER), RequestStatus.APPROVAL_WAITING)).contains(RequestAction.EDIT_DUE);
        }

        @Test
        void noDueEditOnDraftOrFinal() {
            for (RequestStatus s : List.of(RequestStatus.DRAFT, RequestStatus.APPROVED,
                    RequestStatus.REVIEW_COMPLETED)) {
                assertThat(actions(admin(), s)).doesNotContain(RequestAction.EDIT_DUE);
            }
        }
    }

    @Nested
    class Export {

        @Test
        void exportOnlyAfterFinalCompletion() {
            assertThat(actions(actor(REVIEWER), RequestStatus.APPROVED)).contains(RequestAction.EXPORT);
            assertThat(actions(admin(), RequestStatus.REVIEW_COMPLETED)).contains(RequestAction.EXPORT);
            assertThat(actions(actor(REVIEWER), RequestStatus.APPROVAL_WAITING)).doesNotContain(RequestAction.EXPORT);
        }
    }

    @Nested
    class Require {

        @Test
        void invisibleRequestIsNotFound() {
            assertThatThrownBy(() -> policy.require(actor(OUTSIDER), approvalProject, request(RequestStatus.IN_REVIEW),
                    RequestAction.REVIEW))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getCode()).isEqualTo(ErrorCode.NOT_FOUND);
        }

        @Test
        void disallowedActionIsStateConflict() {
            assertThatThrownBy(() -> policy.require(actor(REQUESTER), approvalProject,
                    request(RequestStatus.IN_REVIEW), RequestAction.SUBMIT))
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT);
        }

        @Test
        void allowedActionPasses() {
            policy.require(actor(REQUESTER), approvalProject, request(RequestStatus.DRAFT), RequestAction.SUBMIT);
        }
    }

    @Nested
    class Pending {

        @Test
        void pendingWorkFollowsTheStatus() {
            assertThat(policy.isPendingFor(actor(LEAD), approvalProject, request(RequestStatus.WAITING))).isTrue();
            assertThat(policy.isPendingFor(actor(REVIEWER), approvalProject, request(RequestStatus.WAITING)))
                    .isFalse();
            assertThat(policy.isPendingFor(actor(REQUESTER), approvalProject, request(RequestStatus.CONFIRMING)))
                    .isTrue();
            assertThat(policy.isPendingFor(actor(REVIEWER), approvalProject, request(RequestStatus.IN_REVIEW)))
                    .isTrue();
            assertThat(policy.isPendingFor(actor(LEAD), approvalProject, request(RequestStatus.IN_REVIEW, true)))
                    .isFalse();
            assertThat(policy.isPendingFor(actor(REVIEWER), approvalProject, request(RequestStatus.IN_REVIEW, true)))
                    .isTrue();
            assertThat(policy.isPendingFor(actor(APPROVER), approvalProject,
                    request(RequestStatus.APPROVAL_WAITING))).isTrue();
            assertThat(policy.isPendingFor(actor(INACTIVE_APPROVER), approvalProject,
                    request(RequestStatus.APPROVAL_WAITING))).isFalse();
            assertThat(policy.isPendingFor(actor(REQUESTER), approvalProject, request(RequestStatus.APPROVED)))
                    .isFalse();
        }
    }

    @Test
    void mineCoversAuthoredAssignedAndApprovable() {
        RequestFacts r = request(RequestStatus.APPROVAL_WAITING);
        assertThat(policy.mine(actor(REQUESTER), approvalProject, r)).isTrue();
        assertThat(policy.mine(actor(REVIEWER), approvalProject, r)).isTrue();
        assertThat(policy.mine(actor(APPROVER), approvalProject, r)).isTrue();
        assertThat(policy.mine(actor(REQUESTER_2), approvalProject, r)).isFalse();
        assertThat(policy.mine(admin(), approvalProject, r)).isFalse();
    }

    @Test
    void dueFlagsUseCustomerDueSoonDays() {
        RequestFacts r = new RequestFacts("REQ-1", PROJECT, RequestStatus.IN_REVIEW, REQUESTER, List.of(REVIEWER),
                REVIEWER, false, LocalDate.of(2026, 10, 9), true);
        assertThat(policy.dueSoon(approvalProject, r, java.time.Instant.parse("2026-10-07T01:00:00Z"))).isTrue();
        assertThat(policy.overdue(r, java.time.Instant.parse("2026-10-09T15:00:00Z"))).isTrue();
    }
}
