package com.txtms.domain.request.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestHistory;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.RequestHistoryRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Shared steps of every request mutation: row lock, visibility, policy re-check, optimistic {@code rowVersion},
 * history, and the refreshed detail. Callers run inside their own transaction.
 */
@Component
public class RequestWriteSupport {

    public static final String STATE_CHANGED = "권한 또는 요청 상태가 변경되었습니다";

    private final RequestRepository requests;
    private final ContentRepository contents;
    private final RequestHistoryRepository history;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final RequestPolicy policy;
    private final RequestAssembler assembler;
    private final Clock clock;

    public RequestWriteSupport(RequestRepository requests, ContentRepository contents,
            RequestHistoryRepository history, ProjectAccess projectAccess, UserService userService,
            RequestPolicy policy, RequestAssembler assembler, Clock clock) {
        this.requests = requests;
        this.contents = contents;
        this.history = history;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.policy = policy;
        this.assembler = assembler;
        this.clock = clock;
    }

    /** A locked request with its actor and project. */
    public record Ctx(User user, Actor actor, Project project, ProjectFacts facts, Request request) {

        public ScopedRequest scoped() {
            return ScopedRequest.of(request, facts);
        }

        public long userId() {
            return user.getId();
        }
    }

    /**
     * Locks the request row (serializing writers on the same request) and checks that the user can see it
     * (missing or other-customer requests NOT_FOUND, someone else's draft DRAFT_PRIVATE, otherwise FORBIDDEN).
     */
    public Ctx lock(AuthUser auth, String id) {
        User user = userService.require(auth.userId());
        Actor actor = userService.actorOf(user);
        requests.lockById(id).orElseThrow(BusinessException::notFound);
        Request request = requests.findById(id).orElseThrow(BusinessException::notFound);
        Project project = projectAccess.requireProject(request.getProjectId());
        ProjectFacts facts = projectAccess.facts(project);
        Ctx ctx = new Ctx(user, actor, project, facts, request);
        policy.requireView(actor, facts, ctx.scoped().facts());
        return ctx;
    }

    /** Re-checks the action with the single request policy (REQUEST_STATE_CONFLICT when not allowed now). */
    public void require(Ctx ctx, RequestAction action) {
        policy.require(ctx.actor(), ctx.facts(), ctx.scoped().facts(), action);
    }

    public boolean allows(Ctx ctx, RequestAction action) {
        return policy.allows(ctx.actor(), ctx.facts(), ctx.scoped().facts(), action);
    }

    /** Optimistic check: the client's {@code rowVersion} must match when given (required for workflow actions). */
    public void checkRowVersion(Ctx ctx, Long rowVersion, boolean required) {
        if (rowVersion == null) {
            if (required) {
                throw BusinessException.validation("rowVersion", "rowVersion이 필요합니다");
            }
            return;
        }
        if (rowVersion != ctx.request().getRowVersion()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, STATE_CHANGED);
        }
    }

    public void requireDraft(Ctx ctx) {
        if (ctx.request().getStatus() != com.txtms.domain.request.entity.RequestStatus.DRAFT) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT);
        }
    }

    /** Current (not deleted) content by key. */
    public Content content(Ctx ctx, String key) {
        return contents.findByRequestIdAndKeyAndDeletedFalse(ctx.request().getId(), key)
                .orElseThrow(BusinessException::notFound);
    }

    public List<Content> currentContents(String requestId) {
        return contents.findByRequestIdAndDeletedFalseOrderBySortOrderAsc(requestId);
    }

    /** Next key number and sort order: deleted rows count so numbers are never reused. */
    public int nextKeyNumber(String requestId) {
        return contents.findByRequestIdOrderBySortOrderAsc(requestId).stream()
                .mapToInt(Content::keyNumber).max().orElse(0) + 1;
    }

    public int nextSortOrder(String requestId) {
        return contents.findByRequestIdOrderBySortOrderAsc(requestId).stream()
                .max(Comparator.comparingInt(Content::getSortOrder)).map(c -> c.getSortOrder() + 1).orElse(1);
    }

    public void log(Request r, Long actorId, String action, String detail, Content content) {
        history.save(new RequestHistory(r.getId(), clock.instant(), actorId, action, detail,
                content == null ? null : content.getKey(), content == null ? null : content.getTitle(),
                r.getRound()));
    }

    public void log(Request r, Long actorId, String action, String detail, String contentKey, String contentTitle) {
        history.save(new RequestHistory(r.getId(), clock.instant(), actorId, action, detail, contentKey, contentTitle,
                r.getRound()));
    }

    /** Detail after the mutation (flushes so {@code rowVersion} and child rows are current). */
    public RequestDetail detail(Ctx ctx) {
        requests.flush();
        ScopedRequest s = ctx.scoped();
        return assembler.detail(s, policy.allowedActions(ctx.actor(), s.project(), s.facts()), clock.instant());
    }

    public Instant now() {
        return clock.instant();
    }
}
