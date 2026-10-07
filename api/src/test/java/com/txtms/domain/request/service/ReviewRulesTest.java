package com.txtms.domain.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.service.EditLocks.State;

/** Lock states, revision decisions, notification recipients and texts of the review workflow. */
class ReviewRulesTest {

    private static final Duration TTL = Duration.ofMinutes(30);
    private static final Instant NOW = Instant.parse("2026-10-07T05:00:00Z");

    @Nested
    class Locks {

        @Test
        void freeMineOtherAndExpired() {
            assertThat(EditLocks.state(null, null, 1, NOW, TTL)).isEqualTo(State.FREE);
            assertThat(EditLocks.state(1L, NOW.minusSeconds(60), 1, NOW, TTL)).isEqualTo(State.MINE);
            assertThat(EditLocks.state(2L, NOW.minusSeconds(60), 1, NOW, TTL)).isEqualTo(State.OTHER);
            assertThat(EditLocks.state(2L, NOW.minus(TTL), 1, NOW, TTL)).isEqualTo(State.EXPIRED);
            assertThat(EditLocks.state(1L, NOW.minus(TTL).minusSeconds(1), 1, NOW, TTL)).isEqualTo(State.EXPIRED);
        }

        @Test
        void expiresExactlyAfterTheIdleTime() {
            Instant at = NOW.minus(TTL).plusMillis(1);
            assertThat(EditLocks.expired(at, NOW, TTL)).isFalse();
            assertThat(EditLocks.expired(NOW.minus(TTL), NOW, TTL)).isTrue();
            assertThat(EditLocks.expired(null, NOW, TTL)).isTrue();
            assertThat(EditLocks.expiredBefore(NOW, TTL)).isEqualTo(NOW.minus(TTL));
        }
    }

    @Nested
    class Revisions {

        @Test
        void sameContentKeepsTheVersion() {
            RevisionPlanner.Outcome o = RevisionPlanner.plan(RequestStatus.IN_REVIEW, "a", "a", "t", "t");
            assertThat(o.changed()).isFalse();
            assertThat(o.markAnswerChanged()).isFalse();
        }

        @Test
        void changeInReviewBumpsTheVersionButNotTheRound() {
            RevisionPlanner.Outcome o = RevisionPlanner.plan(RequestStatus.IN_REVIEW, "b", "a", "t2", "t");
            assertThat(o.changed()).isTrue();
            assertThat(o.markAnswerChanged()).isFalse();
        }

        @Test
        void textChangeWhileAnsweringMarksTheAnswer() {
            RevisionPlanner.Outcome o = RevisionPlanner.plan(RequestStatus.CONFIRMING, "b", "a", "t2", "t");
            assertThat(o.changed()).isTrue();
            assertThat(o.markAnswerChanged()).isTrue();
        }

        @Test
        void attachmentOnlyChangeWhileAnsweringDoesNotMarkTheAnswer() {
            RevisionPlanner.Outcome o = RevisionPlanner.plan(RequestStatus.CONFIRMING, "b", "a", "t", "t");
            assertThat(o.changed()).isTrue();
            assertThat(o.markAnswerChanged()).isFalse();
        }

        @Test
        void unchangedSaveWhileAnsweringDoesNotMarkTheAnswer() {
            assertThat(RevisionPlanner.plan(RequestStatus.CONFIRMING, "a", "a", "t", "t").markAnswerChanged())
                    .isFalse();
        }
    }

    @Nested
    class Recipients {

        @Test
        void finalRecipientsDropDuplicatesNullsAndTheActor() {
            assertThat(ReviewRecipients.finalRecipients(java.util.Arrays.asList(1L, 2L, null, 2L, 3L), 3L))
                    .containsExactly(1L, 2L);
        }

        @Test
        void assignmentNotifiesRequesterAndReviewers() {
            assertThat(ReviewRecipients.assignment(1L, List.of(2L, 6L))).containsExactly(1L, 2L, 6L);
        }

        @Test
        void assignmentChangeNotifiesRequesterAddedRemovedAndBothPrimaries() {
            // before: 2 (primary), 6, 7 → after: 6 (primary), 7, 8. Unchanged 7 is not notified.
            assertThat(ReviewRecipients.assignmentChange(1L, List.of(2L, 6L, 7L), 2L, List.of(6L, 7L, 8L), 6L))
                    .containsExactly(1L, 8L, 2L, 6L);
            // primary-only change: requester and both primaries
            assertThat(ReviewRecipients.assignmentChange(1L, List.of(2L, 6L), 2L, List.of(2L, 6L), 6L))
                    .containsExactly(1L, 2L, 6L);
        }

        @Test
        void recallGoesToPrimaryAndOnceToOthersAndLead() {
            ReviewRecipients.Recall r = ReviewRecipients.recall(2L, List.of(2L, 6L), 3L, 1L);
            assertThat(r.decider()).containsExactly(2L);
            assertThat(r.informed()).containsExactly(6L, 3L);
            // the lead is also the primary: only the decision notification
            ReviewRecipients.Recall leadPrimary = ReviewRecipients.recall(3L, List.of(3L, 6L), 3L, 1L);
            assertThat(leadPrimary.decider()).containsExactly(3L);
            assertThat(leadPrimary.informed()).containsExactly(6L);
            // the lead is also a reviewer: informed once
            assertThat(ReviewRecipients.recall(2L, List.of(2L, 3L), 3L, 1L).informed()).containsExactly(3L);
        }

        @Test
        void recallDecisionAndDueChangeRecipients() {
            assertThat(ReviewRecipients.recallDecision(1L, List.of(2L, 3L), 3L)).containsExactly(1L, 2L, 3L);
            assertThat(ReviewRecipients.finalRecipients(ReviewRecipients.recallDecision(1L, List.of(2L, 6L), 3L),
                    2L)).containsExactly(1L, 6L, 3L);
            assertThat(ReviewRecipients.dueChange(1L, 3L, List.of(2L, 3L))).containsExactly(1L, 3L, 2L);
            assertThat(ReviewRecipients.dueChange(1L, null, List.of())).containsExactly(1L);
        }
    }

    @Nested
    class Texts {

        private final Map<Long, String> names = Map.of(2L, "박지훈", 3L, "이도현", 6L, "한가을");

        @Test
        void assignmentAndScheduleDetails() {
            assertThat(ReviewTexts.assignment(List.of(2L, 6L), 2L, names)).isEqualTo("박지훈, 한가을 배정, 주담당 박지훈");
            assertThat(ReviewTexts.assignmentSchedule(LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 9),
                    Urgency.NORMAL, Urgency.URGENT))
                    .isEqualTo("확정 납기 2026-10-10 → 2026-10-09, 긴급도 보통 → 긴급 (배정 시 확정)");
            assertThat(ReviewTexts.assignmentSchedule(LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 10),
                    Urgency.NORMAL, Urgency.NORMAL)).isNull();
            assertThat(ReviewTexts.assignmentSchedule(null, LocalDate.of(2026, 10, 10), Urgency.NORMAL,
                    Urgency.NORMAL)).isEqualTo("확정 납기 - → 2026-10-10 (배정 시 확정)");
            assertThat(ReviewTexts.scheduleChange(LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 12),
                    Urgency.URGENT, Urgency.URGENT, "범위 확대"))
                    .isEqualTo("확정 납기 2026-10-10 → 2026-10-12, 긴급도 긴급 → 긴급\n사유: 범위 확대");
        }

        @Test
        void assignmentChangeDetailAndNotice() {
            assertThat(ReviewTexts.assignmentChange(List.of(2L, 6L), 2L, List.of(6L, 3L), 6L, "휴가", "C1 확인 중",
                    names)).isEqualTo("박지훈, 한가을 (주담당 박지훈) → 한가을, 이도현 (주담당 한가을)"
                            + "\n주담당 변경: 박지훈 → 한가을\n사유: 휴가\n인수인계: C1 확인 중");
            assertThat(ReviewTexts.assignmentChange(List.of(2L), 2L, List.of(2L, 6L), 2L, "r", "h", names))
                    .isEqualTo("박지훈 (주담당 박지훈) → 박지훈, 한가을 (주담당 박지훈)\n사유: r\n인수인계: h");
            assertThat(ReviewTexts.assignmentChangeNotice("한가을", false, "C1 확인 중"))
                    .isEqualTo("검수 담당이 바뀌었습니다. 주담당 한가을. 인수인계: C1 확인 중");
            assertThat(ReviewTexts.assignmentChangeNotice("한가을", true, "h"))
                    .isEqualTo("검수 담당이 바뀌었습니다. 주담당 한가을. 회수 요청 처리 대기 중입니다. 인수인계: h");
        }

        @Test
        void recallDecisionDetails() {
            String prev = ReviewTexts.previousAssignment(List.of(2L, 6L), 2L, names);
            assertThat(prev).isEqualTo("기존 배정: 박지훈, 한가을, 주담당 박지훈");
            assertThat(ReviewTexts.recallDecision(true, "파일 교체", "승인합니다", prev))
                    .isEqualTo("사유: 파일 교체\n처리 의견: 승인합니다\n기존 배정: 박지훈, 한가을, 주담당 박지훈");
            assertThat(ReviewTexts.recallDecision(false, "파일 교체", "거절", prev)).endsWith("주담당 박지훈 (유지)");
        }

        @Test
        void questionAndAnswerNoticesAreShortened() {
            String q = "가".repeat(31);
            assertThat(ReviewTexts.askNotice("이도현", ReviewTexts.target("C1", "콘텐츠 1"), q))
                    .isEqualTo("이도현님이 확인을 요청했습니다 (C1 콘텐츠 1): " + "가".repeat(30) + "…");
            assertThat(ReviewTexts.askNotice("이도현", ReviewTexts.target(null, null), "짧은 질문"))
                    .isEqualTo("이도현님이 확인을 요청했습니다 (요청 전체): 짧은 질문");
            assertThat(ReviewTexts.answerNotice("김서연", "네 맞습니다"))
                    .isEqualTo("김서연님이 답변했습니다. 검수가 다시 시작됩니다. 답변: 네 맞습니다");
            assertThat(ReviewTexts.excerpt("a".repeat(30), 30)).isEqualTo("a".repeat(30));
            assertThat(ReviewTexts.autoReleaseDetail("박지훈")).isEqualTo("박지훈: 30분간 입력 없음");
            assertThat(ReviewTexts.names(List.of(), names)).isEqualTo("-");
        }
    }
}
