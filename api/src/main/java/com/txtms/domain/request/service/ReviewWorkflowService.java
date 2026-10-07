package com.txtms.domain.request.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.domain.request.dto.request.AnswerBody;
import com.txtms.domain.request.dto.request.AskBody;
import com.txtms.domain.request.dto.request.AssignmentBody;
import com.txtms.domain.request.dto.request.AssignmentChangeBody;
import com.txtms.domain.request.dto.request.OpinionBody;
import com.txtms.domain.request.dto.request.RecallBody;
import com.txtms.domain.request.dto.request.RecallDecisionBody;
import com.txtms.domain.request.dto.request.ScheduleBody;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestAsk;
import com.txtms.domain.request.entity.RequestAssignmentChange;
import com.txtms.domain.request.entity.RequestOpinion;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.RequestAskRepository;
import com.txtms.domain.request.repository.RequestAssignmentChangeRepository;
import com.txtms.domain.request.repository.RequestOpinionRepository;
import com.txtms.domain.request.repository.RequestReminderRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;
import com.txtms.global.security.AuthUser;

/**
 * Assignment and review workflow: first assignment, reviewer/primary change, schedule change, opinions, questions
 * and answers, recall and its decision. Every method locks the request row, re-checks the action with the request
 * policy and the {@code rowVersion}, then writes history (with the round) and notifications in one transaction.
 */
@Service
@Transactional
public class ReviewWorkflowService {

    private final RequestWriteSupport support;
    private final ContentLockService locks;
    private final ContentRepository contents;
    private final RequestOpinionRepository opinions;
    private final RequestAskRepository asks;
    private final RequestAssignmentChangeRepository assignmentChanges;
    private final RequestReminderRepository reminders;
    private final UserService userService;
    private final NotificationService notifications;
    private final AuditLogService audit;
    private final int maxText;

    public ReviewWorkflowService(RequestWriteSupport support, ContentLockService locks, ContentRepository contents,
            RequestOpinionRepository opinions, RequestAskRepository asks,
            RequestAssignmentChangeRepository assignmentChanges, RequestReminderRepository reminders,
            UserService userService, NotificationService notifications, AuditLogService audit,
            AppProperties properties) {
        this.support = support;
        this.locks = locks;
        this.contents = contents;
        this.opinions = opinions;
        this.asks = asks;
        this.assignmentChanges = assignmentChanges;
        this.reminders = reminders;
        this.userService = userService;
        this.notifications = notifications;
        this.audit = audit;
        this.maxText = properties.content().maxInfoTextLength();
    }

    // ------------------------------------------------------------------ assignment

    /**
     * WAITING → IN_REVIEW by the lead reviewer: reviewers (active reviewers of the project, not the requester),
     * primary among them (automatic with one reviewer), confirmed due date and urgency. A changed due date or
     * urgency is logged with both values as {@code 납기 변경}; the hope due date is kept.
     */
    public RequestDetail assign(AuthUser auth, String id, AssignmentBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.ASSIGN);
        AssignmentBody b = body == null ? new AssignmentBody(null, null, null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        List<Long> reviewers = reviewerSelection(ctx, b.reviewerIds());
        Long primary = primaryOf(reviewers, b.primaryReviewerId());
        if (b.dueDate() == null) {
            throw BusinessException.validation("dueDate", "확정 납기를 입력하세요");
        }
        Request r = ctx.request();
        LocalDate dueBefore = r.getDueDate();
        Urgency urgencyBefore = r.getUrgency();
        Instant now = support.now();
        r.assign(reviewers, primary, b.dueDate(), b.urgency(), now);

        Map<Long, String> names = names(reviewers);
        String schedule = ReviewTexts.assignmentSchedule(dueBefore, r.getDueDate(), urgencyBefore, r.getUrgency());
        if (schedule != null) {
            support.log(r, ctx.userId(), "납기 변경", schedule, null, null);
        }
        String assignment = ReviewTexts.assignment(reviewers, primary, names);
        support.log(r, ctx.userId(), "검수자 배정", assignment, null, null);
        notifications.notify(ReviewRecipients.assignment(r.getRequesterId(), reviewers), NotificationKind.INFO,
                r.getId(), r.getTitle() + ": " + assignment, ctx.userId());
        return support.detail(ctx);
    }

    /**
     * Reviewer or primary change by the lead reviewer, in review only. Reason and handover are required and the
     * change must differ from the current assignment. The previous assignment is kept as a structured record;
     * locks of removed reviewers are released and logged.
     */
    public RequestDetail changeAssignment(AuthUser auth, String id, AssignmentChangeBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.CHANGE_ASSIGNMENT);
        AssignmentChangeBody b = body == null ? new AssignmentChangeBody(null, null, null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        List<Long> after = reviewerSelection(ctx, b.reviewerIds());
        Long afterPrimary = primaryOf(after, b.primaryReviewerId());
        String reason = requiredText(b.reason(), "reason", "변경 사유");
        String handover = requiredText(b.handover(), "handover", "인수인계 내용");
        Request r = ctx.request();
        List<Long> before = r.getReviewerIds();
        Long beforePrimary = r.getPrimaryReviewerId();
        if (new HashSet<>(before).equals(new HashSet<>(after)) && afterPrimary.equals(beforePrimary)) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "변경된 검수자나 주담당이 없습니다");
        }
        Instant now = support.now();
        r.changeAssignment(after, afterPrimary, now);
        assignmentChanges.save(new RequestAssignmentChange(r.getId(), now, ctx.userId(), r.getRound(),
                idsJson(before), beforePrimary, idsJson(after), afterPrimary, reason, handover));

        List<Long> everyone = new ArrayList<>(before);
        everyone.addAll(after);
        everyone.add(beforePrimary);
        Map<Long, String> names = names(everyone);
        support.log(r, ctx.userId(), "검수자 변경",
                ReviewTexts.assignmentChange(before, beforePrimary, after, afterPrimary, reason, handover, names),
                null, null);
        Set<Long> removed = before.stream().filter(u -> !after.contains(u)).collect(Collectors.toSet());
        locks.releaseLogged(ctx, removed::contains, name -> "검수자 변경으로 " + name + "님의 잠금 해제");
        notifications.notify(
                ReviewRecipients.assignmentChange(r.getRequesterId(), before, beforePrimary, after, afterPrimary),
                NotificationKind.INFO, r.getId(),
                ReviewTexts.assignmentChangeNotice(ReviewTexts.name(afterPrimary, names), r.isRecallPending(),
                        handover),
                ctx.userId());
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ schedule

    /**
     * Confirmed due date and urgency change with a reason (EDIT_DUE). Both values are logged before and after, the
     * re-notification state of the request starts over, and the requester, lead and reviewers are notified.
     */
    public RequestDetail reschedule(AuthUser auth, String id, ScheduleBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_DUE);
        ScheduleBody b = body == null ? new ScheduleBody(null, null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        String reason = requiredText(b.reason(), "reason", "변경 사유");
        if (b.dueDate() == null) {
            throw BusinessException.validation("dueDate", "확정 납기를 입력하세요");
        }
        Request r = ctx.request();
        LocalDate dueBefore = r.getDueDate();
        Urgency urgencyBefore = r.getUrgency();
        r.reschedule(b.dueDate(), b.urgency(), support.now());
        String detail = ReviewTexts.scheduleChange(dueBefore, r.getDueDate(), urgencyBefore, r.getUrgency(), reason);
        support.log(r, ctx.userId(), "납기 변경", detail, null, null);
        reminders.deleteByRequestId(r.getId());
        notifications.notify(ReviewRecipients.dueChange(r.getRequesterId(), ctx.project().getLeadUserId(),
                r.getReviewerIds()), NotificationKind.DUE, r.getId(), r.getTitle() + " 납기 변경: " + detail,
                ctx.userId());
        if (ctx.actor().adminOf(ctx.project().getCustomerId())) {
            audit.record(ctx.userId(), ctx.project().getCustomerId(), "납기 변경", r.getId(), detail);
        }
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ opinions, questions, answers

    /** Reviewer opinion (REVIEW) on a content or the whole request, stored with the current round. */
    public RequestDetail addOpinion(AuthUser auth, String id, OpinionBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.REVIEW);
        OpinionBody b = body == null ? new OpinionBody(null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        String text = requiredText(b.body(), "body", "의견", "의견을 입력하세요");
        Content target = b.contentKey() == null ? null : support.content(ctx, b.contentKey());
        Request r = ctx.request();
        opinions.save(new RequestOpinion(r.getId(), target == null ? null : target.getKey(), ctx.userId(), text,
                r.getRound(), support.now()));
        support.log(r, ctx.userId(), "검수 의견", text, target);
        return support.detail(ctx);
    }

    /**
     * Question to the requester (REVIEW): not while a recall is pending. IN_REVIEW → CONFIRMING (round kept); the
     * reviewers' locks are released (logged) so the requester can edit while answering.
     */
    public RequestDetail ask(AuthUser auth, String id, AskBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.REVIEW);
        AskBody b = body == null ? new AskBody(null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        Request r = ctx.request();
        if (r.isRecallPending()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT,
                    "회수 요청이 처리될 때까지 확인 요청을 보낼 수 없습니다");
        }
        String question = requiredText(b.question(), "question", "확인할 내용", "확인할 내용을 입력하세요");
        Content target = b.contentKey() == null ? null : support.content(ctx, b.contentKey());
        Instant now = support.now();
        r.startConfirming(now);
        asks.save(new RequestAsk(r.getId(), target == null ? null : target.getKey(), ctx.userId(), question, now,
                r.getRound()));
        support.log(r, ctx.userId(), "확인 요청", question, target);
        locks.releaseLogged(ctx, u -> true, name -> "확인 요청 전환으로 " + name + "님의 잠금 해제");
        notifications.notify(List.of(r.getRequesterId()), NotificationKind.ASK, r.getId(),
                ReviewTexts.askNotice(ctx.user().getName(),
                        ReviewTexts.target(target == null ? null : target.getKey(),
                                target == null ? null : target.getTitle()),
                        question),
                ctx.userId());
        return support.detail(ctx);
    }

    /**
     * The requester answers one open question (ANSWER): CONFIRMING → IN_REVIEW. When text was changed by a revision
     * while answering, a new round starts ({@code 재검수 시작}). The requester's own locks are released.
     */
    public RequestDetail answer(AuthUser auth, String id, long askId, AnswerBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.ANSWER);
        AnswerBody b = body == null ? new AnswerBody(null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        Request r = ctx.request();
        RequestAsk ask = asks.findById(askId).filter(a -> a.getRequestId().equals(r.getId()))
                .orElseThrow(BusinessException::notFound);
        if (ask.isAnswered()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "이미 답변한 확인 요청입니다");
        }
        String answer = requiredText(b.answer(), "answer", "답변", "답변을 입력하세요");
        Instant now = support.now();
        ask.answer(answer, ctx.userId(), now);
        String contentTitle = ask.getContentKey() == null ? null
                : contents.findByRequestIdAndKey(r.getId(), ask.getContentKey()).map(Content::getTitle).orElse(null);
        support.log(r, ctx.userId(), "확인 응답", answer, ask.getContentKey(), contentTitle);
        locks.releaseLogged(ctx, u -> true, name -> "확인 응답으로 " + name + "님의 잠금 해제");
        if (r.resumeAfterAnswer(now)) {
            support.log(r, ctx.userId(), "재검수 시작", "확인 응답의 문안 수정으로 " + r.getRound() + "차 검수", null, null);
        }
        notifications.notify(r.getReviewerIds(), NotificationKind.ANSWER, r.getId(),
                ReviewTexts.answerNotice(ctx.user().getName(), answer), ctx.userId());
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ recall

    /**
     * Recall request by the requester (RECALL, in review, none pending). The primary reviewer must decide; the other
     * reviewers and the lead are informed once.
     */
    public RequestDetail requestRecall(AuthUser auth, String id, RecallBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.RECALL);
        RecallBody b = body == null ? new RecallBody(null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        String reason = requiredText(b.reason(), "reason", "회수 사유");
        Request r = ctx.request();
        r.requestRecall(ctx.userId(), support.now(), reason);
        support.log(r, ctx.userId(), "회수 요청", reason, null, null);
        ReviewRecipients.Recall to = ReviewRecipients.recall(r.getPrimaryReviewerId(), r.getReviewerIds(),
                ctx.project().getLeadUserId(), ctx.userId());
        notifications.notify(to.decider(), NotificationKind.RECALL, r.getId(),
                ctx.user().getName() + "님이 회수를 요청했습니다. 승인 또는 거절이 필요합니다", ctx.userId());
        notifications.notify(to.informed(), NotificationKind.INFO, r.getId(), "회수 요청 사유: " + reason,
                ctx.userId());
        return support.detail(ctx);
    }

    /**
     * Primary reviewer's decision (DECIDE_RECALL) with a required comment. Approve: back to draft, assignment
     * cleared, all locks released, next submit opens a new round. Reject: the review goes on. Both log the previous
     * assignment and notify the requester, the reviewers and the lead (assignment before the decision).
     */
    public RequestDetail decideRecall(AuthUser auth, String id, RecallDecisionBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.DECIDE_RECALL);
        RecallDecisionBody b = body == null ? new RecallDecisionBody(null, null, null) : body;
        support.checkRowVersion(ctx, b.rowVersion(), true);
        if (b.approve() == null) {
            throw BusinessException.validation("approve", "승인 또는 거절을 선택하세요");
        }
        String comment = requiredText(b.comment(), "comment", "처리 의견");
        Request r = ctx.request();
        List<Long> reviewers = r.getReviewerIds();
        Long primary = r.getPrimaryReviewerId();
        String reason = r.getRecallReason();
        String previous = ReviewTexts.previousAssignment(reviewers, primary, names(reviewers));
        List<Long> recipients = ReviewRecipients.recallDecision(r.getRequesterId(), reviewers,
                ctx.project().getLeadUserId());
        boolean approve = b.approve();
        Instant now = support.now();
        if (approve) {
            locks.releaseAll(ctx);
            r.approveRecall(now);
            support.log(r, ctx.userId(), "회수 승인", ReviewTexts.recallDecision(true, reason, comment, previous),
                    null, null);
        } else {
            r.rejectRecall(now);
            support.log(r, ctx.userId(), "회수 거절", ReviewTexts.recallDecision(false, reason, comment, previous),
                    null, null);
        }
        notifications.notify(recipients, NotificationKind.INFO, r.getId(),
                "회수 요청이 " + (approve ? "승인" : "거절") + "되었습니다. " + comment, ctx.userId());
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Distinct reviewer ids in the given order; each must be an active reviewer of the project and not the
     * requester.
     */
    private List<Long> reviewerSelection(Ctx ctx, List<Long> ids) {
        if (ids == null || ids.stream().allMatch(java.util.Objects::isNull)) {
            throw BusinessException.validation("reviewerIds", "검수자를 한 명 이상 고르세요");
        }
        List<Long> distinct = new ArrayList<>(new LinkedHashSet<>(
                ids.stream().filter(java.util.Objects::nonNull).toList()));
        Set<Long> candidates = new HashSet<>(ctx.facts().activeReviewers());
        candidates.remove(ctx.request().getRequesterId());
        if (!candidates.containsAll(distinct)) {
            throw BusinessException.validation("reviewerIds", "프로젝트의 활성 검수자만 배정할 수 있습니다(요청자 제외)");
        }
        return distinct;
    }

    private static Long primaryOf(List<Long> reviewers, Long requested) {
        Long primary = requested != null ? requested : reviewers.size() == 1 ? reviewers.getFirst() : null;
        if (primary == null || !reviewers.contains(primary)) {
            throw BusinessException.validation("primaryReviewerId", "주담당 검수자를 지정하세요");
        }
        return primary;
    }

    /** Required free text ({@code {label}을(를) 입력하세요}), trimmed, at most the server text limit. */
    private String requiredText(String value, String field, String label) {
        return requiredText(value, field, label, label + "을(를) 입력하세요");
    }

    private String requiredText(String value, String field, String label, String missingMessage) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation(field, missingMessage);
        }
        if (v.length() > maxText) {
            String message = String.format("%s은(는) 최대 %,d자입니다", label, maxText);
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, message,
                    List.of(new ErrorResponse.FieldErrorItem(field, message)), null);
        }
        return v;
    }

    private Map<Long, String> names(List<Long> ids) {
        return userService.byIds(ids.stream().filter(java.util.Objects::nonNull).distinct().toList()).values()
                .stream().collect(Collectors.toMap(User::getId, User::getName));
    }

    private static String idsJson(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(",", "[", "]"));
    }
}
