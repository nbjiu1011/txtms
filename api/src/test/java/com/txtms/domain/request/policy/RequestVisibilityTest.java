package com.txtms.domain.request.policy;

import static com.txtms.domain.request.policy.PolicyFixtures.ADMIN;
import static com.txtms.domain.request.policy.PolicyFixtures.CUSTOMER;
import static com.txtms.domain.request.policy.PolicyFixtures.OTHER_CUSTOMER;
import static com.txtms.domain.request.policy.PolicyFixtures.OUTSIDER;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER;
import static com.txtms.domain.request.policy.PolicyFixtures.REQUESTER_2;
import static com.txtms.domain.request.policy.PolicyFixtures.project;
import static com.txtms.domain.request.policy.PolicyFixtures.request;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;

import org.junit.jupiter.api.Test;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Why a request cannot be seen: NOT_FOUND across customers, DRAFT_PRIVATE / FORBIDDEN inside the customer. */
class RequestVisibilityTest {

    private final RequestPolicy policy = new RequestPolicy();

    private ErrorCode failure(Actor actor, RequestStatus status, boolean customerActive) {
        BusinessException e = policy.visibilityFailure(actor, project(true, customerActive), request(status));
        return e == null ? null : e.getCode();
    }

    private static Actor inCustomer(long userId, long customerId) {
        return new Actor(userId, customerId, true, false, Set.of());
    }

    @Test
    void visibleRequestsHaveNoFailure() {
        assertThat(failure(inCustomer(REQUESTER, CUSTOMER), RequestStatus.DRAFT, true)).isNull();
        assertThat(failure(inCustomer(REQUESTER_2, CUSTOMER), RequestStatus.WAITING, true)).isNull();
    }

    @Test
    void someoneElsesDraftInTheSameCustomerIsDraftPrivate() {
        BusinessException e = policy.visibilityFailure(inCustomer(REQUESTER_2, CUSTOMER), project(true),
                request(RequestStatus.DRAFT));
        assertThat(e.getCode()).isEqualTo(ErrorCode.DRAFT_PRIVATE);
        assertThat(e.getCode().status().value()).isEqualTo(403);
        assertThat(e.getMessage())
                .isEqualTo("REQ-2610-121는 아직 작성 중인 요청입니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다.");
        assertThat(failure(new Actor(ADMIN, null, true, false, Set.of(CUSTOMER)), RequestStatus.DRAFT, true))
                .isEqualTo(ErrorCode.DRAFT_PRIVATE);
    }

    @Test
    void nonMemberOfTheSameCustomerIsForbidden() {
        assertThat(failure(inCustomer(OUTSIDER, CUSTOMER), RequestStatus.IN_REVIEW, true))
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void otherCustomersOperatorsAndInactiveAreNotFound() {
        assertThat(failure(inCustomer(OUTSIDER, OTHER_CUSTOMER), RequestStatus.IN_REVIEW, true))
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(failure(inCustomer(OUTSIDER, OTHER_CUSTOMER), RequestStatus.DRAFT, true))
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(failure(PolicyFixtures.otherCustomerAdmin(), RequestStatus.IN_REVIEW, true))
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(failure(PolicyFixtures.operator(), RequestStatus.IN_REVIEW, true)).isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(failure(new Actor(OUTSIDER, CUSTOMER, false, false, Set.of()), RequestStatus.IN_REVIEW, true))
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(failure(inCustomer(REQUESTER, CUSTOMER), RequestStatus.IN_REVIEW, false))
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    void requireUsesTheVisibilityFailureBeforeTheAction() {
        assertThatThrownBy(() -> policy.require(inCustomer(REQUESTER_2, CUSTOMER), project(true),
                request(RequestStatus.DRAFT), RequestAction.EDIT_REQUEST))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.DRAFT_PRIVATE));
        assertThatThrownBy(() -> policy.require(inCustomer(REQUESTER, CUSTOMER), project(true),
                request(RequestStatus.WAITING), RequestAction.EDIT_REQUEST))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT));
    }
}
