package com.txtms.domain.request.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.response.ContentVersionResponse;
import com.txtms.domain.request.dto.response.HistoryEntryResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.dto.response.RequestSummary;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentVersion;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.policy.RequestView;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.ContentVersionRepository;
import com.txtms.domain.request.repository.RequestHistoryRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.common.Kst;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

/**
 * Request reads. Every result is filtered by {@link RequestPolicy#canView}; list conditions use the same view
 * predicates as the dashboard so counts and lists always agree.
 */
@Service
@Transactional(readOnly = true)
public class RequestQueryService {

    /** History actions that make up "requests I approved or sent back". */
    public static final Set<String> PROCESSED_ACTIONS = Set.of("승인 완료", "수정 요청");

    /** Newest first by submission (or creation for drafts). */
    public static final Comparator<ScopedRequest> NEWEST_FIRST = Comparator
            .comparing((ScopedRequest s) -> s.request().getSubmittedAt() != null ? s.request().getSubmittedAt()
                    : s.request().getCreatedAt())
            .thenComparing(s -> s.request().getId())
            .reversed();

    private final RequestRepository requests;
    private final ContentRepository contents;
    private final ContentVersionRepository contentVersions;
    private final RequestHistoryRepository history;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final RequestPolicy policy;
    private final RequestAssembler assembler;
    private final Clock clock;

    public RequestQueryService(RequestRepository requests, ContentRepository contents,
            ContentVersionRepository contentVersions, RequestHistoryRepository history, ProjectAccess projectAccess,
            UserService userService, RequestPolicy policy, RequestAssembler assembler, Clock clock) {
        this.requests = requests;
        this.contents = contents;
        this.contentVersions = contentVersions;
        this.history = history;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.policy = policy;
        this.assembler = assembler;
        this.clock = clock;
    }

    /** List filters of {@code GET /api/requests}. All are optional except the scope (project or customer). */
    public record ListQuery(
            Long projectId,
            Long customerId,
            String q,
            ContentType type,
            RequestStatus status,
            Long primaryReviewerId,
            Long reviewerId,
            Long leadUserId,
            LocalDate dueFrom,
            LocalDate dueTo,
            LocalDate submittedFrom,
            LocalDate submittedTo,
            boolean mine,
            RequestView view) {
    }

    public PageResponse<RequestSummary> list(AuthUser auth, ListQuery query, PageQuery page) {
        User user = userService.require(auth.userId());
        if (query.view() != null && query.view().customerScoped() && query.customerId() == null) {
            throw BusinessException.validation("customerId", "이 목록은 customerId가 필요합니다");
        }
        Actor actor = userService.actorOf(user);
        List<Project> scope = projectAccess.requestScope(user, query.projectId(), query.customerId());
        Instant now = clock.instant();
        Set<String> processed = query.view() == RequestView.APPROVAL_PROCESSED ? processedBy(user.getId()) : Set.of();
        List<ScopedRequest> matched = visible(actor, scope).stream()
                .filter(s -> matchesFilters(actor, s, query, now, processed))
                .sorted(NEWEST_FIRST)
                .toList();
        return PageResponse.slice(matched, page, slice -> assembler.summaries(slice, now));
    }

    /** Requests of the given projects visible to the actor (others' drafts excluded). */
    public List<ScopedRequest> visible(Actor actor, Collection<Project> projects) {
        if (projects.isEmpty()) {
            return List.of();
        }
        Map<Long, ProjectFacts> facts = projectAccess.factsOf(projects);
        return requests.findByProjectIdIn(facts.keySet()).stream()
                .map(r -> ScopedRequest.of(r, facts.get(r.getProjectId())))
                .filter(s -> policy.canView(actor, s.project(), s.facts()))
                .toList();
    }

    /** Requests by id with their project facts, regardless of who is looking (visibility is the caller's job). */
    public Map<String, ScopedRequest> scopedByIds(Collection<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<Request> found = requests.findAllById(new HashSet<>(ids));
        Set<Long> projectIds = found.stream().map(Request::getProjectId).collect(Collectors.toSet());
        Map<Long, ProjectFacts> facts = projectAccess.factsOf(
                projectIds.stream().map(projectAccess::requireProject).toList());
        return found.stream().map(r -> ScopedRequest.of(r, facts.get(r.getProjectId())))
                .collect(Collectors.toMap(s -> s.request().getId(), Function.identity(), (a, b) -> a,
                        LinkedHashMap::new));
    }

    /** Current content payloads of every request of the project (variable usage checks). */
    public List<String> currentPayloadsOfProject(long projectId) {
        return contents.findCurrentPayloadsOfProject(projectId);
    }

    public Set<String> processedBy(long userId) {
        return new HashSet<>(history.findRequestIdsByActorAndActions(userId, PROCESSED_ACTIONS));
    }

    public boolean matchesView(RequestView view, Actor actor, ScopedRequest s, Instant now, Set<String> processed) {
        return policy.matches(view, actor, s.project(), s.facts(), now, processed);
    }

    public List<RequestSummary> summaries(List<ScopedRequest> list, Instant now) {
        return assembler.summaries(list, now);
    }

    public RequestDetail detail(AuthUser auth, String id) {
        User user = userService.require(auth.userId());
        Actor actor = userService.actorOf(user);
        ScopedRequest s = requireVisible(actor, id);
        return assembler.detail(s, policy.allowedActions(actor, s.project(), s.facts()), clock.instant());
    }

    public ContentVersionResponse contentVersion(AuthUser auth, String id, String contentKey, int version) {
        User user = userService.require(auth.userId());
        ScopedRequest s = requireVisible(userService.actorOf(user), id);
        Content content = contents.findByRequestIdAndDeletedFalseOrderBySortOrderAsc(s.request().getId()).stream()
                .filter(c -> c.getKey().equals(contentKey))
                .findFirst()
                .orElseThrow(BusinessException::notFound);
        ContentVersion v = contentVersions.findByContentIdAndVersion(content.getId(), version)
                .orElseThrow(BusinessException::notFound);
        return new ContentVersionResponse(v.getVersion(), v.getTitle(), v.getPayload(), v.getFilesSnapshot(),
                v.getCreatedAt(), v.getCreatedBy());
    }

    public List<HistoryEntryResponse> history(AuthUser auth, String id) {
        User user = userService.require(auth.userId());
        ScopedRequest s = requireVisible(userService.actorOf(user), id);
        return history.findByRequestIdOrderByAtAscIdAsc(s.request().getId()).stream()
                .map(h -> new HistoryEntryResponse(h.getId(), h.getAt(), h.getActorId(), h.getAction(), h.getDetail(),
                        h.getContentKey(), h.getContentTitle(), h.getRound()))
                .toList();
    }

    /**
     * The request if it exists and the actor may view it. Otherwise NOT_FOUND for other customers (existence is
     * never revealed), DRAFT_PRIVATE for someone else's draft and FORBIDDEN for other requests of the customer.
     */
    public ScopedRequest requireVisible(Actor actor, String id) {
        Request r = requests.findById(id).orElseThrow(BusinessException::notFound);
        ProjectFacts facts = projectAccess.facts(projectAccess.requireProject(r.getProjectId()));
        ScopedRequest s = ScopedRequest.of(r, facts);
        policy.requireView(actor, s.project(), s.facts());
        return s;
    }

    private boolean matchesFilters(Actor actor, ScopedRequest s, ListQuery q, Instant now, Set<String> processed) {
        Request r = s.request();
        if (q.q() != null && !q.q().isBlank()) {
            String needle = q.q().trim().toLowerCase();
            if (!(r.getTitle() + r.getId()).toLowerCase().contains(needle)) {
                return false;
            }
        }
        if (q.type() != null && r.getType() != q.type()) {
            return false;
        }
        if (q.status() != null && r.getStatus() != q.status()) {
            return false;
        }
        if (q.primaryReviewerId() != null && !q.primaryReviewerId().equals(r.getPrimaryReviewerId())) {
            return false;
        }
        if (q.reviewerId() != null && !r.getReviewerIds().contains(q.reviewerId())) {
            return false;
        }
        if (q.leadUserId() != null && !q.leadUserId().equals(s.project().leadUserId())) {
            return false;
        }
        if (!withinDates(r.getDueDate(), q.dueFrom(), q.dueTo())) {
            return false;
        }
        LocalDate submitted = r.getSubmittedAt() == null ? null : Kst.dateOf(r.getSubmittedAt());
        if (!withinDates(submitted, q.submittedFrom(), q.submittedTo())) {
            return false;
        }
        if (q.mine() && !policy.mine(actor, s.project(), s.facts())) {
            return false;
        }
        return q.view() == null || policy.matches(q.view(), actor, s.project(), s.facts(), now, processed);
    }

    /** Inclusive KST date range; a range filter excludes requests without the date. */
    private static boolean withinDates(LocalDate value, LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return true;
        }
        if (value == null) {
            return false;
        }
        return (from == null || !value.isBefore(from)) && (to == null || !value.isAfter(to));
    }
}
