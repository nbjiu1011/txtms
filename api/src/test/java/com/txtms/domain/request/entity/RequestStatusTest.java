package com.txtms.domain.request.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.global.exception.BusinessException;

class RequestStatusTest {

    @Test
    void allowedTransitions() {
        assertThat(RequestStatus.DRAFT.canTransitionTo(RequestStatus.WAITING)).isTrue();
        assertThat(RequestStatus.WAITING.canTransitionTo(RequestStatus.DRAFT)).isTrue();
        assertThat(RequestStatus.WAITING.canTransitionTo(RequestStatus.IN_REVIEW)).isTrue();
        assertThat(RequestStatus.IN_REVIEW.canTransitionTo(RequestStatus.CONFIRMING)).isTrue();
        assertThat(RequestStatus.CONFIRMING.canTransitionTo(RequestStatus.IN_REVIEW)).isTrue();
        assertThat(RequestStatus.IN_REVIEW.canTransitionTo(RequestStatus.DRAFT)).isTrue();
        assertThat(RequestStatus.IN_REVIEW.canTransitionTo(RequestStatus.REVIEW_COMPLETED)).isTrue();
        assertThat(RequestStatus.IN_REVIEW.canTransitionTo(RequestStatus.APPROVAL_WAITING)).isTrue();
        assertThat(RequestStatus.APPROVAL_WAITING.canTransitionTo(RequestStatus.APPROVED)).isTrue();
        assertThat(RequestStatus.APPROVAL_WAITING.canTransitionTo(RequestStatus.IN_REVIEW)).isTrue();
    }

    @Test
    void forbiddenTransitions() {
        assertThat(RequestStatus.DRAFT.canTransitionTo(RequestStatus.IN_REVIEW)).isFalse();
        assertThat(RequestStatus.IN_REVIEW.canTransitionTo(RequestStatus.WAITING)).as("no cancel after assignment")
                .isFalse();
        assertThat(RequestStatus.CONFIRMING.canTransitionTo(RequestStatus.DRAFT)).as("no recall while confirming")
                .isFalse();
        assertThat(RequestStatus.APPROVAL_WAITING.canTransitionTo(RequestStatus.DRAFT)).isFalse();
        assertThat(RequestStatus.WAITING.canTransitionTo(RequestStatus.APPROVED)).isFalse();
        for (RequestStatus next : RequestStatus.values()) {
            assertThat(RequestStatus.APPROVED.canTransitionTo(next)).isFalse();
            assertThat(RequestStatus.REVIEW_COMPLETED.canTransitionTo(next)).isFalse();
        }
    }

    @Test
    void finalStates() {
        assertThat(RequestStatus.APPROVED.isFinal()).isTrue();
        assertThat(RequestStatus.REVIEW_COMPLETED.isFinal()).isTrue();
        assertThat(RequestStatus.APPROVAL_WAITING.isFinal()).isFalse();
    }

    @Test
    void entityRejectsInvalidTransition() {
        Request r = new Request("REQ-2610-121", 1L, ContentType.SMS, 1L, Instant.EPOCH);
        r.transitionTo(RequestStatus.WAITING, Instant.EPOCH);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.WAITING);
        assertThatThrownBy(() -> r.transitionTo(RequestStatus.APPROVED, Instant.EPOCH))
                .isInstanceOf(BusinessException.class);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.WAITING);
    }
}
