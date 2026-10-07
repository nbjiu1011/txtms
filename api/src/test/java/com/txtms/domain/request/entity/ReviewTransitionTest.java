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

/** Review workflow transitions on the request entity: success and denial, round rules. */
class ReviewTransitionTest {

    private static final Instant T0 = Instant.parse("2026-10-07T01:00:00Z");
    private static final LocalDate HOPE = LocalDate.of(2026, 10, 20);
    private static final LocalDate DUE = LocalDate.of(2026, 10, 15);

    private Request waiting() {
        Request r = new Request("REQ-2610-121", 1L, ContentType.SMS, 1L, T0);
        r.updateInfo(new RequestInfo("제목", HOPE, "p", "t", "b", null, Urgency.NORMAL), T0);
        r.submit(T0, null);
        return r;
    }

    private Request inReview() {
        Request r = waiting();
        r.assign(List.of(2L, 3L), 2L, DUE, Urgency.URGENT, T0);
        return r;
    }

    private static void conflict(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT));
    }

    private static void invalid(Runnable action, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class, e -> {
            assertThat(e.getCode()).isEqualTo(ErrorCode.VALIDATION_FAILED);
            assertThat(e.getMessage()).isEqualTo(message);
        });
    }

    @Test
    void assignmentMovesWaitingToReviewAndKeepsHopeDueDate() {
        Request r = inReview();
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        assertThat(r.getReviewerIds()).containsExactly(2L, 3L);
        assertThat(r.getPrimaryReviewerId()).isEqualTo(2L);
        assertThat(r.getDueDate()).isEqualTo(DUE);
        assertThat(r.getHopeDueDate()).isEqualTo(HOPE);
        assertThat(r.getUrgency()).isEqualTo(Urgency.URGENT);
        assertThat(r.getRound()).isEqualTo(1);
    }

    @Test
    void assignmentNeedsReviewersPrimaryAmongThemDueDateAndWaitingStatus() {
        invalid(() -> waiting().assign(List.of(), 2L, DUE, null, T0), "검수자를 한 명 이상 고르세요");
        invalid(() -> waiting().assign(List.of(2L), 3L, DUE, null, T0), "주담당 검수자를 지정하세요");
        invalid(() -> waiting().assign(List.of(2L), 2L, null, null, T0), "확정 납기를 입력하세요");
        conflict(() -> inReview().assign(List.of(2L), 2L, DUE, null, T0));
        Request draft = new Request("REQ-2610-122", 1L, ContentType.SMS, 1L, T0);
        conflict(() -> draft.assign(List.of(2L), 2L, DUE, null, T0));
        Request kept = waiting();
        kept.assign(List.of(2L), 2L, DUE, null, T0);
        assertThat(kept.getUrgency()).isEqualTo(Urgency.NORMAL);
    }

    @Test
    void assignmentChangeOnlyInReview() {
        Request r = inReview();
        r.changeAssignment(List.of(3L, 4L), 4L, T0);
        assertThat(r.getReviewerIds()).containsExactly(3L, 4L);
        assertThat(r.getPrimaryReviewerId()).isEqualTo(4L);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        conflict(() -> waiting().changeAssignment(List.of(2L), 2L, T0));
        Request confirming = inReview();
        confirming.startConfirming(T0);
        conflict(() -> confirming.changeAssignment(List.of(2L), 2L, T0));
        invalid(() -> inReview().changeAssignment(List.of(3L), 2L, T0), "주담당 검수자를 지정하세요");
    }

    @Test
    void recallRequestOnlyOnceInReview() {
        Request r = inReview();
        r.requestRecall(1L, T0, "사유");
        assertThat(r.isRecallPending()).isTrue();
        assertThat(r.getRecallReason()).isEqualTo("사유");
        conflict(() -> r.requestRecall(1L, T0, "다시"));
        conflict(() -> waiting().requestRecall(1L, T0, "사유"));
        Request confirming = inReview();
        confirming.startConfirming(T0);
        conflict(() -> confirming.requestRecall(1L, T0, "사유"));
    }

    @Test
    void rejectedRecallKeepsTheAssignment() {
        Request r = inReview();
        r.requestRecall(1L, T0, "사유");
        r.rejectRecall(T0);
        assertThat(r.isRecallPending()).isFalse();
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        assertThat(r.getReviewerIds()).containsExactly(2L, 3L);
        conflict(() -> r.rejectRecall(T0));
        conflict(() -> r.approveRecall(T0));
    }

    @Test
    void approvedRecallClearsAssignmentAndResubmitOpensTheNextRound() {
        Request r = inReview();
        r.requestRecall(1L, T0, "사유");
        r.approveRecall(T0);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.DRAFT);
        assertThat(r.getReviewerIds()).isEmpty();
        assertThat(r.getPrimaryReviewerId()).isNull();
        assertThat(r.getRound()).isEqualTo(1);
        r.submit(T0, null);
        assertThat(r.getRound()).isEqualTo(2);
        assertThat(r.getDueDate()).isEqualTo(DUE); // the confirmed due date stays until the next assignment
    }

    @Test
    void askIsBlockedWhileRecallPending() {
        Request r = inReview();
        r.requestRecall(1L, T0, "사유");
        assertThatThrownBy(() -> r.startConfirming(T0)).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getMessage()).isEqualTo("회수 요청이 처리될 때까지 확인 요청을 보낼 수 없습니다"));
        conflict(() -> waiting().startConfirming(T0));
    }

    @Test
    void answerWithoutTextChangeKeepsTheRound() {
        Request r = inReview();
        r.startConfirming(T0);
        assertThat(r.getStatus()).isEqualTo(RequestStatus.CONFIRMING);
        assertThat(r.resumeAfterAnswer(T0)).isFalse();
        assertThat(r.getStatus()).isEqualTo(RequestStatus.IN_REVIEW);
        assertThat(r.getRound()).isEqualTo(1);
    }

    @Test
    void answerAfterTextChangeOpensANewRoundOnce() {
        Request r = inReview();
        r.startConfirming(T0);
        r.markAnswerChanged();
        assertThat(r.resumeAfterAnswer(T0)).isTrue();
        assertThat(r.getRound()).isEqualTo(2);
        assertThat(r.isAnswerChanged()).isFalse();
        r.startConfirming(T0);
        assertThat(r.resumeAfterAnswer(T0)).isFalse();
        assertThat(r.getRound()).isEqualTo(2);
    }

    @Test
    void answerChangedOnlyWhileConfirming() {
        conflict(() -> inReview().markAnswerChanged());
        conflict(() -> inReview().resumeAfterAnswer(T0));
    }

    @Test
    void rescheduleOutsideDraftAndFinalOnly() {
        Request r = inReview();
        r.reschedule(LocalDate.of(2026, 10, 30), null, T0);
        assertThat(r.getDueDate()).isEqualTo(LocalDate.of(2026, 10, 30));
        assertThat(r.getUrgency()).isEqualTo(Urgency.URGENT);
        assertThat(r.getHopeDueDate()).isEqualTo(HOPE);
        Request w = waiting();
        w.reschedule(DUE, Urgency.URGENT, T0);
        assertThat(w.getUrgency()).isEqualTo(Urgency.URGENT);
        invalid(() -> inReview().reschedule(null, null, T0), "확정 납기를 입력하세요");
        conflict(() -> new Request("REQ-2610-123", 1L, ContentType.SMS, 1L, T0).reschedule(DUE, null, T0));
        Request done = inReview();
        done.restoreSeedState(RequestStatus.REVIEW_COMPLETED, 1, T0, T0, List.of(2L), 2L);
        conflict(() -> done.reschedule(DUE, null, T0));
    }
}
