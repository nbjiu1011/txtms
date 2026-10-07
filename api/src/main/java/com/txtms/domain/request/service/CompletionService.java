package com.txtms.domain.request.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.domain.request.dto.request.ReviseBody;
import com.txtms.domain.request.dto.request.WorkflowBody;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.CompletionBundle;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.CompletionBundleRepository;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.request.validation.SubmitValidator;
import com.txtms.domain.user.service.UserService;
import com.txtms.domain.variable.service.VariableService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.json.JsonMapper;

/**
 * Review completion, approval and the approver's revision request. Each action locks the request row, re-checks the
 * policy and {@code rowVersion}, and writes history and notifications in one transaction. Final completion freezes
 * the completion bundle.
 *
 * <p>A completion blocked because no eligible approver exists keeps its side effects (history, notifications to the
 * admins, the requester and the lead): that transaction commits first and the caller then gets
 * {@code NO_ELIGIBLE_APPROVER}.
 */
@Service
public class CompletionService {

    static final String FINAL_CHECK_FAILED = "최종 콘텐츠의 필수값과 연결값을 확인하세요";

    private final RequestWriteSupport support;
    private final RequestPolicy policy;
    private final ContentLockService locks;
    private final RequestCommandService commands;
    private final RequestAssembler assembler;
    private final ContentFileRepository files;
    private final CompletionBundleRepository bundles;
    private final CompletionBundleItemRepository bundleItems;
    private final VariableService variables;
    private final UserService userService;
    private final NotificationService notifications;
    private final JsonMapper json;
    private final TransactionTemplate tx;
    private final int maxText;

    public CompletionService(RequestWriteSupport support, RequestPolicy policy, ContentLockService locks,
            RequestCommandService commands, RequestAssembler assembler, ContentFileRepository files,
            CompletionBundleRepository bundles, CompletionBundleItemRepository bundleItems, VariableService variables,
            UserService userService, NotificationService notifications, JsonMapper json,
            PlatformTransactionManager transactionManager, AppProperties properties) {
        this.support = support;
        this.policy = policy;
        this.locks = locks;
        this.commands = commands;
        this.assembler = assembler;
        this.files = files;
        this.bundles = bundles;
        this.bundleItems = bundleItems;
        this.variables = variables;
        this.userService = userService;
        this.notifications = notifications;
        this.json = json;
        this.tx = new TransactionTemplate(transactionManager);
        this.maxText = properties.content().maxInfoTextLength();
    }

    /** Result of the completion transaction: the new detail, or "blocked" (no eligible approver, side effects kept). */
    private record Outcome(RequestDetail detail) {
        boolean blocked() {
            return detail == null;
        }
    }

    // ------------------------------------------------------------------ complete

    /**
     * The primary reviewer completes the review (COMPLETE). Order: eligible approver (approval customers) → other
     * users' locks → final content check → remaining locks released → APPROVAL_WAITING, or REVIEW_COMPLETED with the
     * completion bundle.
     */
    public RequestDetail complete(AuthUser auth, String id, WorkflowBody body) {
        Outcome outcome = tx.execute(status -> completeInTx(auth, id, body));
        if (outcome == null || outcome.blocked()) {
            throw new BusinessException(ErrorCode.NO_ELIGIBLE_APPROVER);
        }
        return outcome.detail();
    }

    private Outcome completeInTx(AuthUser auth, String id, WorkflowBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.COMPLETE);
        support.checkRowVersion(ctx, body == null ? null : body.rowVersion(), true);
        Request r = ctx.request();
        boolean approval = ctx.facts().approvalEnabled();
        List<Long> eligible = policy.eligibleApprovers(ctx.facts(), ctx.scoped().facts());
        if (approval && eligible.isEmpty()) {
            recordNoEligibleApprover(ctx);
            return new Outcome(null);
        }
        locks.requireNoOtherLocks(ctx);
        SubmitValidator.Result check = commands.validateFinalContents(ctx);
        if (!check.ok()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, FINAL_CHECK_FAILED,
                    check.fieldErrors().isEmpty() ? null : check.fieldErrors(), check.details());
        }
        locks.releaseForCompletion(ctx);
        Instant now = support.now();
        r.completeReview(approval, now);
        if (approval) {
            support.log(r, ctx.userId(), "검수 완료", "주담당 검수 완료, 승인 대기로 전환", null, null);
            notifications.notify(eligible, NotificationKind.APPROVAL, r.getId(),
                    "승인 대기 요청이 있습니다: " + r.getTitle(), ctx.userId());
        } else {
            freeze(ctx, ctx.userId());
            support.log(r, ctx.userId(), "검수 완료", "완료 묶음 고정", null, null);
            notifications.notify(List.of(r.getRequesterId()), NotificationKind.FINAL, r.getId(),
                    r.getTitle() + " 요청이 검수 완료되었습니다", ctx.userId());
        }
        return new Outcome(support.detail(ctx));
    }

    /**
     * No eligible approver: the request stays in review; the active customer admins are asked to assign an
     * approver, the requester and the lead reviewer are told the completion is delayed.
     */
    private void recordNoEligibleApprover(Ctx ctx) {
        Request r = ctx.request();
        support.log(r, ctx.userId(), "승인 대기 전환 차단", "적격 승인자 없음", null, null);
        notifications.notify(userService.activeAdminIdsOf(ctx.project().getCustomerId()), NotificationKind.INFO,
                r.getId(), "적격 승인자 지정 필요: " + r.getTitle(), ctx.userId());
        List<Long> delayed = new ArrayList<>();
        delayed.add(r.getRequesterId());
        delayed.add(ctx.project().getLeadUserId());
        notifications.notify(delayed, NotificationKind.INFO, r.getId(), "적격 승인자 부재로 완료 지연: " + r.getTitle(),
                ctx.userId());
    }

    // ------------------------------------------------------------------ approve / revise

    /** An eligible approver approves (APPROVE): APPROVED with the completion bundle. */
    public RequestDetail approve(AuthUser auth, String id, WorkflowBody body) {
        return tx.execute(status -> {
            Ctx ctx = support.lock(auth, id);
            support.require(ctx, RequestAction.APPROVE);
            support.checkRowVersion(ctx, body == null ? null : body.rowVersion(), true);
            Request r = ctx.request();
            r.approve(support.now());
            freeze(ctx, ctx.userId());
            support.log(r, ctx.userId(), "승인 완료", "완료 묶음 고정", null, null);
            List<Long> recipients = new ArrayList<>();
            recipients.add(r.getRequesterId());
            recipients.addAll(r.getReviewerIds());
            notifications.notify(recipients, NotificationKind.FINAL, r.getId(),
                    r.getTitle() + " 요청이 승인 완료되었습니다", ctx.userId());
            return support.detail(ctx);
        });
    }

    /**
     * An eligible approver sends the request back (REVISE) with a reason, the content, an optional location and the
     * expectation: IN_REVIEW, round + 1, same reviewers. {@code 수정 요청} is logged in the old round,
     * {@code 재검수 시작} in the new one.
     */
    public RequestDetail revise(AuthUser auth, String id, ReviseBody body) {
        return tx.execute(status -> {
            Ctx ctx = support.lock(auth, id);
            support.require(ctx, RequestAction.REVISE);
            ReviseBody b = body == null ? new ReviseBody(null, null, null, null, null) : body;
            support.checkRowVersion(ctx, b.rowVersion(), true);
            String reason = requiredText(b.reason(), "reason", "이유");
            String expectation = requiredText(b.expectation(), "expectation", "기대 내용");
            if (b.contentKey() == null || b.contentKey().isBlank()) {
                throw BusinessException.validation("contentKey", "위치를 선택하세요");
            }
            Content target = support.content(ctx, b.contentKey());
            String location = optionalText(b.location(), "location", "세부 위치");
            Request r = ctx.request();
            support.log(r, ctx.userId(), "수정 요청", ReviewTexts.revisionRequest(reason, target.getKey(), location,
                    expectation), null, null);
            r.reviseByApprover(support.now());
            support.log(r, ctx.userId(), "재검수 시작", "승인자 수정 요청으로 " + r.getRound() + "차 검수 시작", null, null);
            List<Long> recipients = new ArrayList<>();
            recipients.add(r.getRequesterId());
            recipients.addAll(r.getReviewerIds());
            notifications.notify(recipients, NotificationKind.INFO, r.getId(), r.getTitle() + " 수정 요청: " + reason,
                    ctx.userId());
            return support.detail(ctx);
        });
    }

    // ------------------------------------------------------------------ bundle

    /** Freezes the completion bundle of a request that just reached its final status. */
    private void freeze(Ctx ctx, long completedBy) {
        Request r = ctx.request();
        List<CompletionBundles.ContentState> states = new ArrayList<>();
        for (Content c : support.currentContents(r.getId())) {
            String filesJson = assembler.filesSnapshot(files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId()));
            states.add(new CompletionBundles.ContentState(c.getKey(), c.getTitle(), c.getVersion(), c.getPayload(),
                    filesJson, c.getSortOrder()));
        }
        bundles.save(new CompletionBundle(r.getId(), r.getStatus(), r.getCompletedAt(), completedBy,
                CompletionBundles.variablesJson(variables.activeSnapshot(r.getProjectId()), json)));
        for (CompletionBundles.Item item : CompletionBundles.items(states)) {
            bundleItems.save(new CompletionBundleItem(r.getId(), item.contentKey(), item.title(), item.version(),
                    item.payload(), item.filesJson(), item.sortOrder()));
        }
    }

    // ------------------------------------------------------------------ helpers

    private String requiredText(String value, String field, String label) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation(field, label + "을(를) 입력하세요");
        }
        return limit(v, field, label);
    }

    private String optionalText(String value, String field, String label) {
        String v = value == null ? "" : value.trim();
        return v.isEmpty() ? null : limit(v, field, label);
    }

    private String limit(String v, String field, String label) {
        if (v.length() > maxText) {
            String message = String.format("%s은(는) 최대 %,d자입니다", label, maxText);
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, message,
                    List.of(new ErrorResponse.FieldErrorItem(field, message)), null);
        }
        return v;
    }
}
