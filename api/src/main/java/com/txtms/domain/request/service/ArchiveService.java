package com.txtms.domain.request.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.response.ArchiveLineResponse;
import com.txtms.domain.request.entity.CompletionBundle;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.CompletionBundleRepository;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Completed-content archive of a project: bundle items of the finally completed requests the user can see, grouped
 * by content line (follow-up lineage), with the open follow-ups of each line.
 */
@Service
@Transactional(readOnly = true)
public class ArchiveService {

    private final UserService userService;
    private final ProjectAccess projectAccess;
    private final RequestQueryService queries;
    private final CompletionBundleRepository bundles;
    private final CompletionBundleItemRepository bundleItems;
    private final ContentRepository contents;
    private final JsonMapper json;

    public ArchiveService(UserService userService, ProjectAccess projectAccess, RequestQueryService queries,
            CompletionBundleRepository bundles, CompletionBundleItemRepository bundleItems,
            ContentRepository contents, JsonMapper json) {
        this.userService = userService;
        this.projectAccess = projectAccess;
        this.queries = queries;
        this.bundles = bundles;
        this.bundleItems = bundleItems;
        this.contents = contents;
        this.json = json;
    }

    public PageResponse<ArchiveLineResponse> lines(AuthUser auth, Long projectId, ArchiveLines.Criteria criteria,
            PageQuery page) {
        List<ScopedRequest> visible = visibleRequests(auth, projectId);
        List<String> ids = visible.stream().map(s -> s.request().getId()).toList();
        Map<ContentLineage.Ref, ContentLineage.Ref> sources = new HashMap<>();
        List<Content> derived = ids.isEmpty() ? List.of() : contents.findByRequestIdInAndParentRequestIdIsNotNull(ids);
        derived.forEach(c -> sources.put(new ContentLineage.Ref(c.getRequestId(), c.getKey()),
                new ContentLineage.Ref(c.getParentRequestId(), c.getParentContentKey())));

        List<ArchiveLines.Completed> completed = completed(visible, sources);
        Map<String, Request> byId = visible.stream().map(ScopedRequest::request)
                .collect(Collectors.toMap(Request::getId, Function.identity()));
        List<ArchiveLines.FollowUp> followUps = new ArrayList<>();
        for (Content c : derived) {
            Request r = byId.get(c.getRequestId());
            if (r == null || r.getStatus().isFinal() || c.isDeleted()) {
                continue;
            }
            String line = ContentLineage.lineKey(new ContentLineage.Ref(c.getParentRequestId(),
                    c.getParentContentKey()), sources);
            followUps.add(new ArchiveLines.FollowUp(line, r.getId(), r.getStatus(), r.getTitle(), r.getCreatedAt()));
        }
        List<ArchiveLines.Line> lines = ArchiveLines.build(completed, followUps, criteria);
        return PageResponse.slice(lines, page, slice -> slice.stream().map(ArchiveService::response).toList());
    }

    /** Campaign options of the archive filter: campaigns of the visible completed requests, sorted. */
    public List<String> campaigns(AuthUser auth, Long projectId) {
        return visibleRequests(auth, projectId).stream().map(ScopedRequest::request)
                .filter(r -> r.getStatus().isFinal())
                .map(Request::getCampaign).filter(c -> c != null && !c.isBlank())
                .distinct().sorted().toList();
    }

    private List<ScopedRequest> visibleRequests(AuthUser auth, Long projectId) {
        if (projectId == null) {
            throw BusinessException.validation("projectId", "projectId가 필요합니다");
        }
        User user = userService.require(auth.userId());
        Actor actor = userService.actorOf(user);
        Project project = projectAccess.requireWorkProject(user, projectId);
        return queries.visible(actor, List.of(project));
    }

    private List<ArchiveLines.Completed> completed(List<ScopedRequest> visible,
            Map<ContentLineage.Ref, ContentLineage.Ref> sources) {
        Map<String, Request> finals = visible.stream().map(ScopedRequest::request)
                .filter(r -> r.getStatus().isFinal())
                .collect(Collectors.toMap(Request::getId, Function.identity()));
        if (finals.isEmpty()) {
            return List.of();
        }
        Map<String, CompletionBundle> bundleById = bundles.findAllById(finals.keySet()).stream()
                .collect(Collectors.toMap(CompletionBundle::getRequestId, Function.identity()));
        Map<String, Map<String, String>> values = new HashMap<>();
        List<ArchiveLines.Completed> out = new ArrayList<>();
        for (CompletionBundleItem item : items(bundleById.keySet())) {
            Request r = finals.get(item.getRequestId());
            CompletionBundle b = bundleById.get(item.getRequestId());
            Map<String, String> frozen = values.computeIfAbsent(b.getRequestId(),
                    k -> CompletionBundles.values(b.getVariablesSnapshot(), json));
            List<ArchiveLines.FileRef> files = new ArrayList<>();
            for (JsonNode f : json.readTree(item.getFilesSnapshot())) {
                files.add(new ArchiveLines.FileRef(f.path("name").asString(), f.path("version").asInt(1)));
            }
            String line = ContentLineage.lineKey(new ContentLineage.Ref(r.getId(), item.getContentKey()), sources);
            out.add(new ArchiveLines.Completed(line, r.getId(), r.getTitle(), r.getType(), b.getStatus(),
                    b.getCompletedAt(), r.getCampaign(), item.getContentKey(), item.getTitle(), item.getVersion(),
                    json.readTree(item.getPayload()), files, frozen));
        }
        return out;
    }

    private List<CompletionBundleItem> items(Collection<String> requestIds) {
        return requestIds.isEmpty() ? List.of()
                : bundleItems.findByRequestIdInOrderByRequestIdAscSortOrderAsc(requestIds);
    }

    private static ArchiveLineResponse response(ArchiveLines.Line line) {
        ArchiveLines.Completed l = line.latest();
        ArchiveLineResponse.Latest latest = new ArchiveLineResponse.Latest(l.requestId(), l.contentKey(), l.title(),
                l.version(), l.type(), l.status(), l.completedAt(), l.campaign(), ArchiveLines.preview(l),
                ArchiveLines.previewRaw(l), l.files().stream().map(ArchiveLines.FileRef::name).filter(Objects::nonNull).toList(),
                ArchiveLines.resolvedText(l));
        List<ArchiveLineResponse.Past> past = line.past().stream()
                .map(p -> new ArchiveLineResponse.Past(p.requestId(), p.requestTitle(), p.contentKey(), p.title(),
                        p.version(),
                        p.completedAt()))
                .toList();
        List<ArchiveLineResponse.FollowUp> followUps = line.followUps().stream()
                .map(f -> new ArchiveLineResponse.FollowUp(f.requestId(), f.status(), f.title())).toList();
        return new ArchiveLineResponse(line.lineKey(), latest, past, followUps, line.campaigns());
    }
}
