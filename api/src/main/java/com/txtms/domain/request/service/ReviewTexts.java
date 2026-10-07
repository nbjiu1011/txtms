package com.txtms.domain.request.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.txtms.domain.request.entity.Urgency;

/** History details and notification texts of the review workflow (pure, shown to users as they are). */
public final class ReviewTexts {

    /** Question excerpt length in the "확인 요청" notification. */
    static final int QUESTION_EXCERPT = 30;
    /** Answer excerpt length in the "확인 응답" notification. */
    static final int ANSWER_EXCERPT = 100;

    private ReviewTexts() {
    }

    /** User names joined with ", " in the given order ("-" when empty, unknown ids as "-"). */
    public static String names(List<Long> ids, Map<Long, String> names) {
        if (ids.isEmpty()) {
            return "-";
        }
        return String.join(", ", ids.stream().map(id -> name(id, names)).toList());
    }

    public static String name(Long id, Map<Long, String> names) {
        String n = id == null ? null : names.get(id);
        return n == null ? "-" : n;
    }

    /** KST date as {@code YYYY-MM-DD}, "-" when empty. */
    public static String date(LocalDate d) {
        return d == null ? "-" : d.toString();
    }

    public static String urgency(Urgency u) {
        return u == Urgency.URGENT ? "긴급" : "보통";
    }

    /** {@code text} up to {@code max} characters, "…" appended when cut. */
    public static String excerpt(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() <= max ? text : text.substring(0, max) + "…";
    }

    /**
     * {@code 납기 변경} detail written at the first assignment when the confirmed due date or the urgency changes
     * ({@code 확정 납기 A → B, 긴급도 보통 → 긴급 (배정 시 확정)}); null when neither changed.
     */
    public static String assignmentSchedule(LocalDate dueBefore, LocalDate dueAfter, Urgency urgencyBefore,
            Urgency urgencyAfter) {
        List<String> parts = new ArrayList<>();
        if (!Objects.equals(dueBefore, dueAfter)) {
            parts.add("확정 납기 " + date(dueBefore) + " → " + date(dueAfter));
        }
        if (urgencyBefore != urgencyAfter) {
            parts.add("긴급도 " + urgency(urgencyBefore) + " → " + urgency(urgencyAfter));
        }
        return parts.isEmpty() ? null : String.join(", ", parts) + " (배정 시 확정)";
    }

    /** {@code 검수자 배정} detail and the tail of its notification: {@code 이도현, 박지훈 배정, 주담당 박지훈}. */
    public static String assignment(List<Long> reviewers, Long primary, Map<Long, String> names) {
        return names(reviewers, names) + " 배정, 주담당 " + name(primary, names);
    }

    /** {@code 검수자 변경} detail: before → after, primary change line, reason and handover. */
    public static String assignmentChange(List<Long> before, Long beforePrimary, List<Long> after,
            Long afterPrimary, String reason, String handover, Map<Long, String> names) {
        StringBuilder sb = new StringBuilder()
                .append(names(before, names)).append(" (주담당 ").append(name(beforePrimary, names)).append(") → ")
                .append(names(after, names)).append(" (주담당 ").append(name(afterPrimary, names)).append(')');
        if (!Objects.equals(beforePrimary, afterPrimary)) {
            sb.append("\n주담당 변경: ").append(name(beforePrimary, names)).append(" → ")
                    .append(name(afterPrimary, names));
        }
        return sb.append("\n사유: ").append(reason).append("\n인수인계: ").append(handover).toString();
    }

    /** Notification of a reviewer/primary change (a pending recall is mentioned for the new primary). */
    public static String assignmentChangeNotice(String primaryName, boolean recallPending, String handover) {
        return "검수 담당이 바뀌었습니다. 주담당 " + primaryName + "."
                + (recallPending ? " 회수 요청 처리 대기 중입니다." : "") + " 인수인계: " + handover;
    }

    /** {@code 납기 변경} detail of a schedule change: both values before and after, and the reason. */
    public static String scheduleChange(LocalDate dueBefore, LocalDate dueAfter, Urgency urgencyBefore,
            Urgency urgencyAfter, String reason) {
        return "확정 납기 " + date(dueBefore) + " → " + date(dueAfter) + ", 긴급도 " + urgency(urgencyBefore) + " → "
                + urgency(urgencyAfter) + "\n사유: " + reason;
    }

    /** Previous assignment in recall decisions: {@code 기존 배정: A, B, 주담당 A}. */
    public static String previousAssignment(List<Long> reviewers, Long primary, Map<Long, String> names) {
        return "기존 배정: " + names(reviewers, names) + ", 주담당 " + name(primary, names);
    }

    public static String recallDecision(boolean approved, String reason, String comment, String previous) {
        return "사유: " + reason + "\n처리 의견: " + comment + "\n" + previous + (approved ? "" : " (유지)");
    }

    /** Target of a question or opinion: {@code C1 콘텐츠 제목}, or {@code 요청 전체}. */
    public static String target(String contentKey, String contentTitle) {
        if (contentKey == null) {
            return "요청 전체";
        }
        return contentTitle == null || contentTitle.isBlank() ? contentKey : contentKey + " " + contentTitle;
    }

    /** {@code 이도현님이 확인을 요청했습니다 (C1 콘텐츠 1): 질문 앞 30자…}. */
    public static String askNotice(String askerName, String target, String question) {
        return askerName + "님이 확인을 요청했습니다 (" + target + "): " + excerpt(question, QUESTION_EXCERPT);
    }

    /** {@code 김서연님이 답변했습니다. 검수가 다시 시작됩니다. 답변: …}. */
    public static String answerNotice(String requesterName, String answer) {
        return requesterName + "님이 답변했습니다. 검수가 다시 시작됩니다. 답변: " + excerpt(answer, ANSWER_EXCERPT);
    }

    /** {@code 수정 요청} detail: {@code 사유: …\n위치: C1 세부 위치\n기대 내용: …} (location detail optional). */
    public static String revisionRequest(String reason, String contentKey, String location, String expectation) {
        String where = location == null || location.isBlank() ? contentKey : contentKey + " " + location;
        return "사유: " + reason + "\n위치: " + where + "\n기대 내용: " + expectation;
    }

    public static String autoReleaseDetail(String ownerName) {
        return ownerName + ": 30분간 입력 없음";
    }
}
