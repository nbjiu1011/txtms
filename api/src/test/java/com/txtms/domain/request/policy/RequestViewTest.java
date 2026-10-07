package com.txtms.domain.request.policy;

import static com.txtms.domain.request.policy.PolicyFixtures.APPROVER;
import static com.txtms.domain.request.policy.PolicyFixtures.LEAD;
import static com.txtms.domain.request.policy.PolicyFixtures.PROJECT;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER_2;
import static com.txtms.domain.request.policy.PolicyFixtures.REVIEWER;
import static com.txtms.domain.request.policy.PolicyFixtures.actor;
import static com.txtms.domain.request.policy.PolicyFixtures.project;
import static com.txtms.domain.request.policy.PolicyFixtures.request;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.request.entity.RequestStatus;

class RequestViewTest {

    private static final Instant NOW = Instant.parse("2026-10-07T01:00:00Z"); // 10:00 KST

    private final RequestPolicy policy = new RequestPolicy();
    private final ProjectFacts facts = project(true);

    private boolean matches(RequestView view, long user, RequestFacts r) {
        return policy.matches(view, actor(user), facts, r, NOW, Set.of());
    }

    private static RequestFacts due(RequestStatus status, LocalDate dueDate, List<Long> reviewers) {
        return new RequestFacts("REQ-1", PROJECT, status, REQUESTER, reviewers,
                reviewers.isEmpty() ? null : reviewers.getFirst(), false, dueDate);
    }

    @Test
    void requesterViews() {
        assertThat(matches(RequestView.MY_DRAFT, REQUESTER, request(RequestStatus.DRAFT))).isTrue();
        assertThat(matches(RequestView.MY_DRAFT, REQUESTER, request(RequestStatus.WAITING))).isFalse();
        assertThat(matches(RequestView.MY_CONFIRMING, REQUESTER, request(RequestStatus.CONFIRMING))).isTrue();
        assertThat(matches(RequestView.MY_CONFIRMING, REQUESTER_2, request(RequestStatus.CONFIRMING))).isFalse();
        for (RequestStatus s : List.of(RequestStatus.WAITING, RequestStatus.IN_REVIEW,
                RequestStatus.APPROVAL_WAITING)) {
            assertThat(matches(RequestView.MY_IN_PROGRESS, REQUESTER, request(s))).isTrue();
        }
        for (RequestStatus s : List.of(RequestStatus.DRAFT, RequestStatus.CONFIRMING, RequestStatus.APPROVED)) {
            assertThat(matches(RequestView.MY_IN_PROGRESS, REQUESTER, request(s))).isFalse();
        }
    }

    @Test
    void reviewerViews() {
        assertThat(matches(RequestView.MY_REVIEW, REVIEWER, request(RequestStatus.IN_REVIEW))).isTrue();
        assertThat(matches(RequestView.MY_REVIEW, REVIEWER, request(RequestStatus.CONFIRMING))).isFalse();
        assertThat(matches(RequestView.MY_REVIEW, APPROVER, request(RequestStatus.IN_REVIEW))).isFalse();
        assertThat(matches(RequestView.RECALL_PENDING, REVIEWER, request(RequestStatus.IN_REVIEW, true))).isTrue();
        assertThat(matches(RequestView.RECALL_PENDING, LEAD, request(RequestStatus.IN_REVIEW, true))).isFalse();
        assertThat(matches(RequestView.RECALL_PENDING, REVIEWER, request(RequestStatus.IN_REVIEW))).isFalse();
        assertThat(matches(RequestView.MY_ASSIGNED_ACTIVE, LEAD, request(RequestStatus.APPROVAL_WAITING))).isTrue();
        assertThat(matches(RequestView.MY_ASSIGNED_ACTIVE, LEAD, request(RequestStatus.APPROVED))).isFalse();
        assertThat(matches(RequestView.MY_ASSIGNED_DONE, LEAD, request(RequestStatus.APPROVED))).isTrue();
        assertThat(matches(RequestView.MY_ASSIGNED_DONE, REQUESTER, request(RequestStatus.APPROVED))).isFalse();
    }

    @Test
    void leadViews() {
        assertThat(matches(RequestView.WAITING_ASSIGNMENT, LEAD, request(RequestStatus.WAITING))).isTrue();
        assertThat(matches(RequestView.WAITING_ASSIGNMENT, REVIEWER, request(RequestStatus.WAITING))).isFalse();
        assertThat(matches(RequestView.WAITING_ASSIGNMENT, LEAD, request(RequestStatus.IN_REVIEW))).isFalse();
    }

    @Test
    void dueViews() {
        RequestFacts overdue = due(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 6), List.of(REVIEWER));
        RequestFacts soonAssigned = due(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 8), List.of(REVIEWER));
        RequestFacts soonWaiting = due(RequestStatus.WAITING, LocalDate.of(2026, 10, 8), List.of());
        RequestFacts later = due(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 20), List.of(REVIEWER));

        assertThat(matches(RequestView.OVERDUE, LEAD, overdue)).isTrue();
        assertThat(matches(RequestView.OVERDUE, LEAD, soonAssigned)).isFalse();
        assertThat(matches(RequestView.DUE_SOON, REVIEWER, soonAssigned)).isTrue();
        assertThat(matches(RequestView.DUE_SOON, REVIEWER, soonWaiting)).as("not assigned to me").isFalse();
        assertThat(matches(RequestView.DUE_SOON, LEAD, soonWaiting)).as("lead sees all").isTrue();
        assertThat(matches(RequestView.DUE_SOON, LEAD, later)).isFalse();
        assertThat(matches(RequestView.DUE_SOON, LEAD, overdue)).isFalse();
        // 기획서 8.3 요청자 지표 "납기 임박": the requester's own requests
        assertThat(matches(RequestView.DUE_SOON, REQUESTER, soonWaiting)).as("my request").isTrue();
        assertThat(matches(RequestView.DUE_SOON, REQUESTER_2, soonWaiting)).as("someone else's").isFalse();
        // D-3 counts in KST calendar days: 2026-10-10 is D-3 on 2026-10-07 (10:00 KST), 2026-10-11 is D-4
        RequestFacts dMinus3 = due(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 10), List.of(REVIEWER));
        RequestFacts dMinus4 = due(RequestStatus.IN_REVIEW, LocalDate.of(2026, 10, 11), List.of(REVIEWER));
        assertThat(matches(RequestView.DUE_SOON, LEAD, dMinus3)).isTrue();
        assertThat(matches(RequestView.DUE_SOON, LEAD, dMinus4)).isFalse();
    }

    @Test
    void reviewerConfirmingView() {
        // 기획서 8.3 검수자 지표 "확인 요청": assigned requests waiting for the requester's answer
        assertThat(matches(RequestView.MY_ASSIGNED_CONFIRMING, REVIEWER, request(RequestStatus.CONFIRMING))).isTrue();
        assertThat(matches(RequestView.MY_ASSIGNED_CONFIRMING, LEAD, request(RequestStatus.CONFIRMING))).isTrue();
        assertThat(matches(RequestView.MY_ASSIGNED_CONFIRMING, REVIEWER, request(RequestStatus.IN_REVIEW))).isFalse();
        assertThat(matches(RequestView.MY_ASSIGNED_CONFIRMING, REQUESTER, request(RequestStatus.CONFIRMING)))
                .isFalse();
        assertThat(RequestView.MY_ASSIGNED_CONFIRMING.customerScoped()).isFalse();
    }

    @Test
    void approvalViews() {
        RequestFacts waiting = request(RequestStatus.APPROVAL_WAITING);
        assertThat(matches(RequestView.APPROVAL_PENDING, APPROVER, waiting)).isTrue();
        assertThat(matches(RequestView.APPROVAL_PENDING, REVIEWER, waiting)).isFalse();
        assertThat(matches(RequestView.APPROVAL_QUEUE, REVIEWER, waiting)).isTrue();
        assertThat(matches(RequestView.APPROVAL_QUEUE, APPROVER, request(RequestStatus.APPROVED))).isFalse();
        assertThat(policy.matches(RequestView.APPROVAL_PROCESSED, actor(APPROVER), facts,
                request(RequestStatus.APPROVED), NOW, Set.of("REQ-2610-121"))).isTrue();
        assertThat(matches(RequestView.APPROVAL_PROCESSED, APPROVER, request(RequestStatus.APPROVED))).isFalse();
    }

    @Test
    void customerViews() {
        assertThat(matches(RequestView.CUSTOMER_IN_PROGRESS, LEAD, request(RequestStatus.WAITING))).isTrue();
        assertThat(matches(RequestView.CUSTOMER_IN_PROGRESS, REQUESTER, request(RequestStatus.DRAFT))).isFalse();
        assertThat(matches(RequestView.CUSTOMER_IN_PROGRESS, LEAD, request(RequestStatus.APPROVED))).isFalse();
        assertThat(matches(RequestView.CUSTOMER_COMPLETED, LEAD, request(RequestStatus.REVIEW_COMPLETED))).isTrue();
        assertThat(matches(RequestView.CUSTOMER_COMPLETED, LEAD, request(RequestStatus.APPROVAL_WAITING))).isFalse();
        assertThat(RequestView.CUSTOMER_COMPLETED.customerScoped()).isTrue();
        assertThat(RequestView.MY_DRAFT.customerScoped()).isFalse();
    }
}
