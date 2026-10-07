package com.txtms.domain.request.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/** Completion, approval and the approver's revision request on the request entity. */
class CompletionTransitionTest {

    private static final Instant T0 = Instant.parse("2026-10-07T01:00:00Z");
    private static final Instant T1 = Instant.parse("2026-10-08T02:00:00Z");

    private Request inReview() {
        Request r = new Request("REQ-2610-121", 1L, ContentType.SMS, 1L, T0);
        r.updateInfo(new RequestInfo("제목", LocalDate.of(2026, 10, 20), "p", "t", "b", null, Urgency.NORMAL), T0);
        r.submit(T0, null);
        r.assign(List.of(2L, 3L), 2L, LocalDate.of(2026, 10, 15), null, T0);
        return r;
    }

    private static void conflict(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT));
    }

    @Test
    void completionWithoutApprovalIsFinal() {
        Request r = inReview();
        r.completeReview(false, T1);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.REVIEW_COMPLETED);
        assertThat(r.getStatus().isFinal()).isTrue();
        assertThat(r.getCompletedAt()).isEqualTo(T1);
        assertThat(r.getRound()).isEqualTo(1);
        conflict(() -> r.completeReview(false, T1));
        conflict(() -> r.approve(T1));
        conflict(() -> r.reviseByApprover(T1));
    }

    @Test
    void completionWithApprovalWaitsThenApprovalIsFinal() {
        Request r = inReview();
        r.completeReview(true, T0);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.APPROVAL_WAITING);
        assertThat(r.getCompletedAt()).isNull();
        assertThat(r.getReviewerIds()).containsExactly(2L, 3L);
        r.approve(T1);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.APPROVED);
        assertThat(r.getCompletedAt()).isEqualTo(T1);
        conflict(() -> r.reviseByApprover(T1));
    }

    @Test
    void revisionByApproverReturnsToReviewWithTheSameReviewersAndNextRound() {
        Request r = inReview();
        r.completeReview(true, T0);
        r.reviseByApprover(T1);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        assertThat(r.getRound()).isEqualTo(2);
        assertThat(r.getReviewerIds()).containsExactly(2L, 3L);
        assertThat(r.getPrimaryReviewerId()).isEqualTo(2L);
        r.completeReview(true, T1);
        r.approve(T1);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.APPROVED);
        assertThat(r.getRound()).isEqualTo(2);
    }

    @Test
    void completionIsDeniedOutsideReviewAndWhileRecallIsPending() {
        Request waiting = new Request("REQ-2610-122", 1L, ContentType.SMS, 1L, T0);
        conflict(() -> waiting.completeReview(false, T1));
        conflict(() -> waiting.approve(T1));
        Request r = inReview();
        r.requestRecall(1L, T0, "사유");
        conflict(() -> r.completeReview(false, T1));
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        Request confirming = inReview();
        confirming.startConfirming(T0);
        conflict(() -> confirming.completeReview(true, T1));
    }
}
