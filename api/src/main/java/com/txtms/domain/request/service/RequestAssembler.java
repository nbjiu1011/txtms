package com.txtms.domain.request.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.txtms.domain.request.dto.response.AskResponse;
import com.txtms.domain.request.dto.response.BundleResponse;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.dto.response.FileMeta;
import com.txtms.domain.request.dto.response.OpinionResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.dto.response.RequestSummary;
import com.txtms.domain.request.entity.CompletionBundle;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentFile;
import com.txtms.domain.request.entity.ContentFileVersion;
import com.txtms.domain.request.entity.ContentVersion;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestHistory;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.CompletionBundleRepository;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.repository.ContentFileVersionRepository;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.ContentVersionRepository;
import com.txtms.domain.request.repository.RequestAskRepository;
import com.txtms.domain.request.repository.RequestHistoryRepository;
import com.txtms.domain.request.repository.RequestOpinionRepository;
import com.txtms.global.config.AppProperties;

import tools.jackson.databind.json.JsonMapper;

/** Builds RequestSummary / RequestDetail responses, loading child rows in bulk. */
@Component
public class RequestAssembler {

    /** History actions whose last occurrence marks each stage of the status track. */
    private static final Map<String, Set<String>> STAGE_ACTIONS = stageActions();

    private final ContentRepository contents;
    private final ContentVersionRepository contentVersions;
    private final ContentFileRepository files;
    private final ContentFileVersionRepository fileVersions;
    private final RequestOpinionRepository opinions;
    private final RequestAskRepository asks;
    private final RequestHistoryRepository history;
    private final CompletionBundleRepository bundles;
    private final CompletionBundleItemRepository bundleItems;
    private final RequestPolicy policy;
    private final JsonMapper json;
    private final Duration lockTtl;

    public RequestAssembler(ContentRepository contents, ContentVersionRepository contentVersions,
            ContentFileRepository files, ContentFileVersionRepository fileVersions, RequestOpinionRepository opinions,
            RequestAskRepository asks, RequestHistoryRepository history, CompletionBundleRepository bundles,
            CompletionBundleItemRepository bundleItems, RequestPolicy policy, JsonMapper json,
            AppProperties properties) {
        this.contents = contents;
        this.contentVersions = contentVersions;
        this.files = files;
        this.fileVersions = fileVersions;
        this.opinions = opinions;
        this.asks = asks;
        this.history = history;
        this.bundles = bundles;
        this.bundleItems = bundleItems;
        this.policy = policy;
        this.json = json;
        this.lockTtl = properties.lock().ttl();
    }

    /** Current (non-deleted) contents and attachments of several requests. */
    private record Children(Map<String, List<Content>> contentsByRequest, Map<Long, List<ContentFile>> filesByContent) {
    }

    private Children loadChildren(Collection<String> requestIds) {
        if (requestIds.isEmpty()) {
            return new Children(Map.of(), Map.of());
        }
        List<Content> all = contents.findByRequestIdInAndDeletedFalseOrderBySortOrderAsc(requestIds);
        Map<String, List<Content>> byRequest = all.stream()
                .collect(Collectors.groupingBy(Content::getRequestId, LinkedHashMap::new, Collectors.toList()));
        List<Long> contentIds = all.stream().map(Content::getId).toList();
        Map<Long, List<ContentFile>> byContent = contentIds.isEmpty() ? Map.of()
                : files.findByContentIdInAndDeletedFalseOrderBySortOrderAsc(contentIds).stream()
                        .collect(Collectors.groupingBy(ContentFile::getContentId, LinkedHashMap::new,
                                Collectors.toList()));
        return new Children(byRequest, byContent);
    }

    /** Summaries without a viewer ({@code approvable} false). */
    public List<RequestSummary> summaries(List<ScopedRequest> requests, Instant now) {
        return summaries(requests, now, null);
    }

    /** Summaries as seen by {@code viewerId} ({@code approvable} per request). */
    public List<RequestSummary> summaries(List<ScopedRequest> requests, Instant now, Long viewerId) {
        Children children = loadChildren(requests.stream().map(s -> s.request().getId()).toList());
        return requests.stream().map(s -> summary(s, children, now, approvable(s, viewerId))).toList();
    }

    private boolean approvable(ScopedRequest s, Long viewerId) {
        return viewerId != null && s.request().getStatus() == com.txtms.domain.request.entity.RequestStatus.APPROVAL_WAITING
                && policy.eligibleApprovers(s.project(), s.facts()).contains(viewerId);
    }

    private RequestSummary summary(ScopedRequest s, Children children, Instant now, boolean approvable) {
        Request r = s.request();
        List<Content> cs = children.contentsByRequest().getOrDefault(r.getId(), List.of());
        List<VolumeCalculator.ContentInput> inputs = new ArrayList<>();
        for (Content c : cs) {
            List<VolumeCalculator.FileInput> fileInputs = children.filesByContent().getOrDefault(c.getId(), List.of())
                    .stream().map(f -> new VolumeCalculator.FileInput(f.getUnit(), f.getReviewAmount())).toList();
            inputs.add(new VolumeCalculator.ContentInput(json.readTree(c.getPayload()), fileInputs));
        }
        return new RequestSummary(r.getId(), r.getProjectId(), r.getType(), r.getTitle(), r.getStatus(), r.getRound(),
                r.getRequesterId(), r.getReviewerIds(), r.getPrimaryReviewerId(), s.project().leadUserId(),
                r.getHopeDueDate(), r.getDueDate(), r.getUrgency(), r.getSubmittedAt(), r.getCreatedAt(),
                r.getCompletedAt(), r.isRecallPending(), r.getParentRequestId(), r.getCampaign(),
                policy.dueSoon(s.project(), s.facts(), now), policy.overdue(s.facts(), now), cs.size(),
                cs.stream().map(Content::getVersion).toList(),
                cs.stream().map(c -> new RequestSummary.ContentRef(c.getKey(), c.getTitle())).toList(),
                VolumeCalculator.compute(r.getType(), inputs), approvable);
    }

    public RequestDetail detail(ScopedRequest s, Set<RequestAction> allowedActions, Instant now) {
        Request r = s.request();
        Children children = loadChildren(List.of(r.getId()));
        RequestSummary summary = summary(s, children, now, allowedActions.contains(RequestAction.APPROVE));
        List<Content> cs = children.contentsByRequest().getOrDefault(r.getId(), List.of());

        List<ContentResponse> contentResponses = contents(cs, children.filesByContent(), now);

        List<OpinionResponse> opinionResponses = opinions.findByRequestIdOrderByCreatedAtAscIdAsc(r.getId()).stream()
                .map(o -> new OpinionResponse(o.getId(), o.getAuthorId(), o.getContentKey(), o.getBody(), o.getRound(),
                        o.getCreatedAt()))
                .toList();
        List<RequestDetail.CoReviewer> coReviewers = CoReviewers.of(r.getReviewerIds(), r.getPrimaryReviewerId(),
                opinionResponses.stream().map(o -> new CoReviewers.Opinion(o.authorId(), o.round())).toList());
        List<AskResponse> askResponses = asks.findByRequestIdOrderByAskedAtAscIdAsc(r.getId()).stream()
                .map(a -> new AskResponse(a.getId(), a.getAskedBy(), a.getContentKey(), a.getQuestion(),
                        a.getAskedAt(), a.getAnswer(), a.getAnsweredBy(), a.getAnsweredAt(), a.getRound()))
                .toList();
        List<RequestHistory> entries = history.findByRequestIdOrderByAtAscIdAsc(r.getId());

        RequestDetail.Recall recall = r.isRecallPending()
                ? new RequestDetail.Recall(r.getRecallRequestedBy(), r.getRecallRequestedAt(), r.getRecallReason())
                : null;
        RequestDetail.Parent parent = r.getParentRequestId() == null ? null
                : new RequestDetail.Parent(r.getParentRequestId(), r.getParentContentKey());

        return new RequestDetail(summary, r.getPurpose(), r.getTarget(), r.getBackground(), recall, parent,
                contentResponses, opinionResponses, askResponses, policy.eligibleApprovers(s.project(), s.facts()),
                coReviewers, entries.size(), stageTimes(entries), bundle(r), allowedActions, r.getRowVersion(),
                r.nextSubmitRound());
    }

    /** Content responses with their files and versions. */
    public List<ContentResponse> contents(List<Content> cs, Instant now) {
        List<Long> ids = cs.stream().map(Content::getId).toList();
        Map<Long, List<ContentFile>> byContent = ids.isEmpty() ? Map.of()
                : files.findByContentIdInAndDeletedFalseOrderBySortOrderAsc(ids).stream()
                        .collect(Collectors.groupingBy(ContentFile::getContentId, LinkedHashMap::new,
                                Collectors.toList()));
        return contents(cs, byContent, now);
    }

    public ContentResponse content(Content c, Instant now) {
        return contents(List.of(c), now).getFirst();
    }

    private List<ContentResponse> contents(List<Content> cs, Map<Long, List<ContentFile>> filesByContent,
            Instant now) {
        List<Long> contentIds = cs.stream().map(Content::getId).toList();
        Map<Long, List<ContentVersion>> versionsByContent = contentIds.isEmpty() ? Map.of()
                : contentVersions.findByContentIdInOrderByVersionAsc(contentIds).stream()
                        .collect(Collectors.groupingBy(ContentVersion::getContentId));
        Map<Long, List<ContentFileVersion>> fileVersionsByFile = fileVersionsOf(
                filesByContent.values().stream().flatMap(List::stream).toList());
        return cs.stream().map(c -> new ContentResponse(
                c.getKey(), c.getTitle(), c.getVersion(), c.getPayload(),
                filesByContent.getOrDefault(c.getId(), List.of()).stream()
                        .map(f -> fileMeta(f, fileVersionsByFile.getOrDefault(f.getId(), List.of()))).toList(),
                lock(c, now), c.getSavedAt(),
                versionsByContent.getOrDefault(c.getId(), List.of()).stream()
                        .map(v -> new ContentResponse.VersionRef(v.getVersion(), v.getCreatedAt(), v.getCreatedBy()))
                        .toList()))
                .toList();
    }

    private Map<Long, List<ContentFileVersion>> fileVersionsOf(List<ContentFile> fs) {
        List<Long> fileIds = fs.stream().map(ContentFile::getId).toList();
        return fileIds.isEmpty() ? Map.of()
                : fileVersions.findByFileIdInOrderByVersionAsc(fileIds).stream()
                        .collect(Collectors.groupingBy(ContentFileVersion::getFileId));
    }

    /** FileMeta of one attachment with its version list. */
    public FileMeta fileMeta(ContentFile f) {
        return fileMeta(f, fileVersions.findByFileIdOrderByVersionAsc(f.getId()));
    }

    /** FileMeta array JSON stored in content version snapshots and completion bundles. */
    public String filesSnapshot(List<ContentFile> fs) {
        Map<Long, List<ContentFileVersion>> byFile = fileVersionsOf(fs);
        return json.writeValueAsString(fs.stream()
                .map(f -> fileMeta(f, byFile.getOrDefault(f.getId(), List.of()))).toList());
    }

    private ContentResponse.Lock lock(Content c, Instant now) {
        if (c.getLockUserId() == null || c.getLockAt() == null) {
            return null;
        }
        Instant expiresAt = c.getLockAt().plus(lockTtl);
        return expiresAt.isAfter(now) ? new ContentResponse.Lock(c.getLockUserId(), c.getLockAt(), expiresAt) : null;
    }

    static FileMeta fileMeta(ContentFile f, List<ContentFileVersion> versions) {
        ContentFileVersion current = versions.stream().filter(v -> v.getVersion() == f.getCurrentVersion())
                .findFirst().orElse(null);
        return new FileMeta(f.getId(), f.getName(), f.getExt(), f.getUnit(), f.getSizeBytes(), f.getTotalAmount(),
                f.getReviewAmount(), f.getRangeNote(), f.getCurrentVersion(),
                current == null ? null : current.getScanStatus(),
                versions.stream().map(v -> new FileMeta.FileVersion(v.getVersion(), v.getName(), v.getCreatedAt(),
                        v.getCreatedBy(), v.getSizeBytes())).toList());
    }

    private BundleResponse bundle(Request r) {
        if (!r.getStatus().isFinal()) {
            return null;
        }
        CompletionBundle b = bundles.findById(r.getId()).orElse(null);
        if (b == null) {
            return null;
        }
        List<BundleResponse.Item> items = bundleItems.findByRequestIdOrderBySortOrderAsc(r.getId()).stream()
                .map((CompletionBundleItem i) -> new BundleResponse.Item(i.getContentKey(), i.getTitle(),
                        i.getVersion(), i.getPayload(), i.getFilesSnapshot()))
                .toList();
        return new BundleResponse(b.getStatus(), b.getCompletedAt(), b.getCompletedBy(), b.getVariablesSnapshot(),
                items);
    }

    static Map<String, Instant> stageTimes(List<RequestHistory> entries) {
        Map<String, Instant> times = new LinkedHashMap<>();
        STAGE_ACTIONS.keySet().forEach(k -> times.put(k, null));
        for (RequestHistory h : entries) {
            STAGE_ACTIONS.forEach((stage, actions) -> {
                if (actions.contains(h.getAction())) {
                    Instant prev = times.get(stage);
                    if (prev == null || !h.getAt().isBefore(prev)) {
                        times.put(stage, h.getAt());
                    }
                }
            });
        }
        return times;
    }

    private static Map<String, Set<String>> stageActions() {
        Map<String, Set<String>> m = new LinkedHashMap<>();
        m.put("DRAFT", Set.of("요청 작성", "요청 복제", "후속 요청 작성", "샘플 요청 생성"));
        m.put("WAITING", Set.of("검수 요청"));
        m.put("IN_REVIEW", Set.of("검수자 배정"));
        m.put("COMPLETED", Set.of("검수 완료"));
        m.put("APPROVED", Set.of("승인 완료"));
        return m;
    }
}
