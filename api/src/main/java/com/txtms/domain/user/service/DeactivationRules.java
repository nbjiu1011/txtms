package com.txtms.domain.user.service;

import java.util.List;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * Checks of a user deactivation by the customer admin (pure, actions.md §2.13 {@code deact}, §10 #16), in this order:
 * <ol>
 * <li>the target must be an active account, not the caller, not the customer's last active admin</li>
 * <li>no assigned review in {@code CONFIRMING} / {@code APPROVAL_WAITING} (the prototype's pre-check)</li>
 * <li>no own request in progress as requester (waiting, in review, confirming, approval waiting)</li>
 * <li>not the only active approver of an approval project</li>
 * <li>reviews in progress or led projects need a substitute and a handover note</li>
 * <li>the substitute: an active reviewer of the customer other than the target, never a requester of an affected
 * project or the author of a handed-over request</li>
 * </ol>
 * State problems are {@code REQUEST_STATE_CONFLICT} (with the affected ids/names in {@code details}), input problems
 * {@code VALIDATION_FAILED}.
 */
public final class DeactivationRules {

    public static final String SELF = "본인 계정은 비활성화할 수 없습니다";
    public static final String NOT_ACTIVE = "활성 사용자만 비활성화할 수 있습니다";
    public static final String LAST_ADMIN = "마지막 고객사 관리자는 비활성화할 수 없습니다. 다른 관리자를 먼저 지정하세요";
    public static final String BLOCKED_REVIEW = "확인 요청·승인 대기 중에는 담당자를 변경할 수 없습니다. 해당 업무를 먼저 처리하세요";
    public static final String LAST_APPROVER = "마지막 승인자입니다. 새 승인자를 먼저 지정하세요";
    public static final String SUBSTITUTE_INVALID = "대체자는 같은 고객사의 활성 검수자여야 합니다";
    public static final String SUBSTITUTE_REQUESTER = "해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다";

    private DeactivationRules() {
    }

    /** The substitute as seen by the checks (null when none was given). */
    public record Substitute(boolean usable, boolean requesterConflict) {
    }

    /**
     * @param blockingReviews     ids of assigned requests in confirming / approval waiting
     * @param requesting          ids of the target's own requests in progress
     * @param lastApproverProjects names of approval projects whose only active approver is the target
     * @param needsSubstitute     there are reviews in progress to hand over or projects the target leads
     */
    public record Facts(boolean self, boolean activeAccount, boolean lastAdmin, List<String> blockingReviews,
            List<String> requesting, List<String> lastApproverProjects, boolean needsSubstitute,
            Substitute substitute, boolean handoverGiven) {
    }

    public static void check(Facts f) {
        if (f.self()) {
            throw conflict(SELF, null);
        }
        if (!f.activeAccount()) {
            throw conflict(NOT_ACTIVE, null);
        }
        if (f.lastAdmin()) {
            throw conflict(LAST_ADMIN, null);
        }
        if (!f.blockingReviews().isEmpty()) {
            throw conflict(BLOCKED_REVIEW, f.blockingReviews());
        }
        if (!f.requesting().isEmpty()) {
            throw conflict("요청자로 진행 중인 요청이 " + f.requesting().size()
                    + "건 있습니다. 요청을 완료하거나 취소·회수한 뒤 비활성화하세요", f.requesting());
        }
        if (!f.lastApproverProjects().isEmpty()) {
            throw conflict(LAST_APPROVER, f.lastApproverProjects());
        }
        if (!f.needsSubstitute()) {
            return;
        }
        if (f.substitute() == null) {
            throw BusinessException.validation("substituteUserId", "대체자을(를) 입력하세요");
        }
        if (!f.handoverGiven()) {
            throw BusinessException.validation("handover", "인수인계 내용을(를) 입력하세요");
        }
        if (!f.substitute().usable()) {
            throw BusinessException.validation("substituteUserId", SUBSTITUTE_INVALID);
        }
        if (f.substitute().requesterConflict()) {
            throw BusinessException.validation("substituteUserId", SUBSTITUTE_REQUESTER);
        }
    }

    private static BusinessException conflict(String message, List<String> details) {
        return new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, message, null,
                details == null ? null : List.copyOf(details));
    }
}
