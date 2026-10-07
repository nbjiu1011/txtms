package com.txtms.domain.request.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.service.SubmissionPlanner;
import com.txtms.domain.request.service.SubmissionPlanner.VersionStep;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

class RequestRoundTest {

    private static final Instant T0 = Instant.parse("2026-10-07T01:00:00Z");
    private static final LocalDate HOPE = LocalDate.of(2026, 10, 20);

    private Request draft() {
        Request r = new Request("REQ-2610-121", 1L, ContentType.SMS, 1L, T0);
        r.updateInfo(new RequestInfo("제목", HOPE, "p", "t", "b", null, Urgency.NORMAL), T0);
        return r;
    }

    @Test
    void firstSubmitKeepsRoundOneAndStampsSubmissionAndDueDate() {
        Request r = draft();
        assertThat(r.getDueDate()).isEqualTo(HOPE); // hope due date also sets the due date while drafting
        r.submit(T0.plusSeconds(60), "k1");
        assertThat(r.getStatus()).isEqualTo(RequestStatus.WAITING);
        assertThat(r.getRound()).isEqualTo(1);
        assertThat(r.getSubmittedAt()).isEqualTo(T0.plusSeconds(60));
        assertThat(r.getSubmitIdempotencyKey()).isEqualTo("k1");
        assertThat(r.isCancelled()).isFalse();
    }

    @Test
    void cancelThenResubmitKeepsRoundAndFirstSubmissionTime() {
        Request r = draft();
        r.submit(T0.plusSeconds(60), null);
        r.cancel(T0.plusSeconds(120));
        assertThat(r.getStatus()).isEqualTo(RequestStatus.DRAFT);
        assertThat(r.isCancelled()).isTrue();
        assertThat(r.isRoundBump()).isFalse();
        r.submit(T0.plusSeconds(180), null);
        assertThat(r.getRound()).isEqualTo(1);
        assertThat(r.getSubmittedAt()).isEqualTo(T0.plusSeconds(60));
        assertThat(r.isCancelled()).isFalse();
    }

    @Test
    void approvedRecallOpensTheNextRoundOnResubmit() {
        Request r = draft();
        r.submit(T0, null);
        r.restoreSeedState(RequestStatus.IN_REVIEW, 1, T0, null, List.of(2L, 6L), 2L);
        r.markRecallRequested(1L, T0, "사유");
        r.approveRecall(T0.plusSeconds(10));
        assertThat(r.getStatus()).isEqualTo(RequestStatus.DRAFT);
        assertThat(r.getReviewerIds()).isEmpty();
        assertThat(r.getPrimaryReviewerId()).isNull();
        assertThat(r.isRecallPending()).isFalse();
        assertThat(r.isRoundBump()).isTrue();
        assertThat(r.getRound()).isEqualTo(1);
        r.submit(T0.plusSeconds(20), null);
        assertThat(r.getRound()).isEqualTo(2);
        assertThat(r.isRoundBump()).isFalse();
        assertThat(r.getSubmittedAt()).isEqualTo(T0);
    }

    @Test
    void emptyDueDateTakesHopeDueDateOnSubmit() {
        Request r = new Request("REQ-2610-122", 1L, ContentType.SMS, 1L, T0);
        r.schedule(HOPE, null, Urgency.NORMAL);
        r.submit(T0, null);
        assertThat(r.getDueDate()).isEqualTo(HOPE);
    }

    @Test
    void invalidTransitionsAreRejected() {
        Request r = draft();
        assertThatThrownBy(() -> r.cancel(T0)).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getCode()).isEqualTo(ErrorCode.REQUEST_STATE_CONFLICT));
        r.submit(T0, null);
        assertThatThrownBy(() -> r.submit(T0, null)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> r.updateInfo(r.info(), T0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> r.changeType(ContentType.RCS, T0)).isInstanceOf(BusinessException.class);
    }

    @Test
    void updateInfoReportsWhetherAnythingChanged() {
        Request r = draft();
        assertThat(r.updateInfo(r.info(), T0)).isFalse();
        assertThat(r.updateInfo(new RequestInfo("새 제목", HOPE, "p", "t", "b", "캠페인", Urgency.URGENT), T0)).isTrue();
        assertThat(r.getTitle()).isEqualTo("새 제목");
        assertThat(r.getUrgency()).isEqualTo(Urgency.URGENT);
    }

    @Test
    void contentVersionSteps() {
        assertThat(SubmissionPlanner.versionStep(true, "a", "b")).isEqualTo(VersionStep.START);
        assertThat(SubmissionPlanner.versionStep(false, "a", null)).isEqualTo(VersionStep.SNAPSHOT);
        assertThat(SubmissionPlanner.versionStep(false, "a", "a")).isEqualTo(VersionStep.KEEP);
        assertThat(SubmissionPlanner.versionStep(false, "a", "b")).isEqualTo(VersionStep.BUMP);
    }

    @Test
    void contentKeyNumbers() {
        assertThat(Content.keyNumber("C12")).isEqualTo(12);
        assertThat(Content.keyNumber("X")).isZero();
    }
}
