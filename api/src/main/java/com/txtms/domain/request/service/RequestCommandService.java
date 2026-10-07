package com.txtms.domain.request.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.entity.ProjectTemplate;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.request.ChangeTypeBody;
import com.txtms.domain.request.dto.request.CreateRequestBody;
import com.txtms.domain.request.dto.request.FollowUpBody;
import com.txtms.domain.request.dto.request.SaveContentBody;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentFile;
import com.txtms.domain.request.entity.ContentFileVersion;
import com.txtms.domain.request.entity.ContentImage;
import com.txtms.domain.request.entity.ContentVersion;
import com.txtms.domain.request.entity.FileScanStatus;
import com.txtms.domain.request.entity.FileUnit;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestInfo;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.repository.ContentFileVersionRepository;
import com.txtms.domain.request.repository.ContentImageRepository;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.ContentVersionRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.request.validation.PayloadNormalizer;
import com.txtms.domain.request.validation.SubmitValidator;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.domain.variable.service.VariableService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Request authoring writes: create, request information, type change, clone, contents, draft autosave, submit and
 * cancel. Every method locks the request row, re-checks the policy and state, then writes history and
 * notifications in the same transaction.
 */
@Service
@Transactional
public class RequestCommandService {

    static final int TITLE_MAX = 200;
    static final int CAMPAIGN_MAX = 200;

    private final RequestRepository requests;
    private final ContentRepository contents;
    private final ContentVersionRepository contentVersions;
    private final ContentFileRepository files;
    private final ContentFileVersionRepository fileVersions;
    private final ContentImageRepository images;
    private final CompletionBundleItemRepository bundleItems;
    private final RequestIdGenerator idGenerator;
    private final RequestWriteSupport support;
    private final RequestQueryService queries;
    private final RequestAssembler assembler;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final ContentTypeService contentTypes;
    private final VariableService variables;
    private final NotificationService notifications;
    private final PayloadNormalizer normalizer;
    private final SubmitValidator submitValidator;
    private final JsonMapper json;
    private final ContentFingerprint fingerprints;
    private final AppProperties.Content limits;

    public RequestCommandService(RequestRepository requests, ContentRepository contents,
            ContentVersionRepository contentVersions, ContentFileRepository files,
            ContentFileVersionRepository fileVersions, ContentImageRepository images,
            CompletionBundleItemRepository bundleItems, RequestIdGenerator idGenerator,
            RequestWriteSupport support, RequestQueryService queries, RequestAssembler assembler,
            ProjectAccess projectAccess, UserService userService, ContentTypeService contentTypes,
            VariableService variables, NotificationService notifications, PayloadNormalizer normalizer,
            SubmitValidator submitValidator, JsonMapper json, ContentFingerprint fingerprints,
            AppProperties properties) {
        this.requests = requests;
        this.contents = contents;
        this.contentVersions = contentVersions;
        this.files = files;
        this.fileVersions = fileVersions;
        this.images = images;
        this.bundleItems = bundleItems;
        this.idGenerator = idGenerator;
        this.support = support;
        this.queries = queries;
        this.assembler = assembler;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.contentTypes = contentTypes;
        this.variables = variables;
        this.notifications = notifications;
        this.normalizer = normalizer;
        this.submitValidator = submitValidator;
        this.json = json;
        this.fingerprints = fingerprints;
        this.limits = properties.content();
    }

    // ------------------------------------------------------------------ create / clone

    public RequestDetail create(AuthUser auth, CreateRequestBody body) {
        if (body == null || body.projectId() == null) {
            throw BusinessException.validation("projectId", "프로젝트를 선택하세요");
        }
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, body.projectId());
        requireRequester(user, project);
        ContentType type = body.type() != null ? body.type()
                : contentTypes.firstActive().orElseThrow(
                        () -> BusinessException.validation("type", "사용 중인 유형만 선택할 수 있습니다"));
        if (!contentTypes.isActive(type)) {
            throw BusinessException.validation("type", "사용 중인 유형만 선택할 수 있습니다");
        }
        Instant now = support.now();
        Request r = requests.save(new Request(idGenerator.next(now), project.getId(), type, user.getId(), now));
        contents.save(new Content(r.getId(), "C1", "콘텐츠 1", write(PayloadNormalizer.blank(type)), 1, now));
        support.log(r, user.getId(), "요청 작성", null, null, null);
        return detailOf(auth, r.getId());
    }

    /**
     * Copies a request into a new draft: information (without hope due date), contents renumbered from C1 with
     * their titles, payloads and current attachments (stored objects are shared, they are immutable). Card images
     * are copied to the new request. Versions are not copied (the new draft starts at v1 without snapshots).
     */
    public RequestDetail cloneRequest(AuthUser auth, String id) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.CLONE);
        Request source = ctx.request();
        Instant now = support.now();
        Request copy = new Request(idGenerator.next(now), source.getProjectId(), source.getType(), ctx.userId(), now);
        RequestInfo info = source.info();
        copy.updateInfo(new RequestInfo(truncate(info.title() + " (복제)", TITLE_MAX), null, info.purpose(),
                info.target(), info.background(), info.campaign(), Urgency.NORMAL), now);
        copy = requests.save(copy);

        int n = 0;
        for (Content c : support.currentContents(source.getId())) {
            n++;
            Content target = contents.save(new Content(copy.getId(), "C" + n, c.getTitle(), c.getPayload(), n, now));
            String payload = copyImages(source.getId(), copy.getId(), target, c.getPayload(), ctx.userId(), now);
            if (!payload.equals(c.getPayload())) {
                target.saveDraft(target.getTitle(), payload, now);
            }
            int order = 0;
            for (ContentFile f : files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId())) {
                ContentFileVersion current = fileVersions.findByFileIdAndVersion(f.getId(), f.getCurrentVersion())
                        .orElse(null);
                ContentFile nf = files.save(new ContentFile(target.getId(), f.getName(), f.getExt(), f.getUnit(),
                        f.getSizeBytes(), ++order, now, ctx.userId()));
                nf.describeRange(f.getTotalAmount(), f.getReviewAmount(), f.getRangeNote());
                fileVersions.save(new ContentFileVersion(nf.getId(), 1, f.getName(), f.getSizeBytes(),
                        current == null ? null : current.getStorageKey(),
                        current == null ? FileScanStatus.SAFE : current.getScanStatus(), now, ctx.userId()));
            }
        }
        support.log(copy, ctx.userId(), "요청 복제", "원본 " + source.getId(), null, null);
        requests.flush();
        return detailOf(auth, copy.getId());
    }

    /**
     * Follow-up of a finally completed request (FOLLOW_UP): a new draft linked to the original whose contents are
     * the completion bundle items (all, or the one given) with their frozen title, payload and attachments (the
     * frozen file version becomes v1 of a new file sharing the stored object; card images are copied). Every new
     * content records the completed content it came from (per-content lineage).
     */
    public RequestDetail followUp(AuthUser auth, String id, FollowUpBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.FOLLOW_UP);
        Request source = ctx.request();
        String only = body == null || body.contentKey() == null || body.contentKey().isBlank() ? null
                : body.contentKey().trim();
        List<CompletionBundleItem> items = bundleItems.findByRequestIdOrderBySortOrderAsc(source.getId()).stream()
                .filter(i -> only == null || i.getContentKey().equals(only)).toList();
        if (items.isEmpty()) {
            throw BusinessException.notFound();
        }
        Instant now = support.now();
        Request copy = new Request(idGenerator.next(now), source.getProjectId(), source.getType(), ctx.userId(), now);
        RequestInfo info = source.info();
        copy.updateInfo(new RequestInfo(truncate(info.title() + " 후속", TITLE_MAX), null, info.purpose(),
                info.target(), info.background(), info.campaign(), Urgency.NORMAL), now);
        copy.linkParent(source.getId(), only);
        copy = requests.save(copy);

        int n = 0;
        for (CompletionBundleItem item : items) {
            n++;
            Content target = contents.save(new Content(copy.getId(), "C" + n, item.getTitle(), item.getPayload(), n,
                    now));
            target.linkParent(source.getId(), item.getContentKey());
            String payload = copyImages(source.getId(), copy.getId(), target, item.getPayload(), ctx.userId(), now);
            if (!payload.equals(item.getPayload())) {
                target.saveDraft(target.getTitle(), payload, now);
            }
            copyFrozenFiles(target, item.getFilesSnapshot(), ctx.userId(), now);
        }
        String versions = String.join(", ", items.stream().map(i -> i.getContentKey() + " v" + i.getVersion())
                .toList());
        support.log(copy, ctx.userId(), "후속 요청 작성", "원본 " + source.getId() + " " + versions, null, null);
        requests.flush();
        return detailOf(auth, copy.getId());
    }

    /** New attachments from a frozen FileMeta array: the frozen version's stored object becomes v1. */
    private void copyFrozenFiles(Content target, String filesSnapshot, long userId, Instant now) {
        int order = 0;
        for (JsonNode meta : json.readTree(filesSnapshot)) {
            long fileId = meta.path("id").asLong();
            int version = meta.path("version").asInt(1);
            ContentFileVersion frozen = fileVersions.findByFileIdAndVersion(fileId, version).orElse(null);
            String name = meta.path("name").asString();
            long size = meta.path("sizeBytes").asLong();
            ContentFile nf = files.save(new ContentFile(target.getId(), name, meta.path("ext").asString(),
                    FileUnit.valueOf(meta.path("unit").asString()), size, ++order, now, userId));
            nf.describeRange(intOrNull(meta.get("totalAmount")), intOrNull(meta.get("reviewAmount")),
                    meta.path("rangeNote").isString() ? meta.path("rangeNote").asString() : null);
            fileVersions.save(new ContentFileVersion(nf.getId(), 1, name, size,
                    frozen == null ? null : frozen.getStorageKey(),
                    frozen == null ? FileScanStatus.SAFE : frozen.getScanStatus(), now, userId));
        }
    }

    private static Integer intOrNull(JsonNode n) {
        return n == null || n.isNull() ? null : n.asInt();
    }

    private String copyImages(String fromRequest, String toRequest, Content target, String payload, long userId,
            Instant now) {
        JsonNode tree = json.readTree(payload);
        List<String> keys = PayloadNormalizer.imageKeys(tree);
        if (keys.isEmpty()) {
            return payload;
        }
        Map<String, String> renamed = new HashMap<>();
        for (ContentImage img : images.findByRequestIdAndImageKeyIn(fromRequest, keys)) {
            String key = AttachmentService.newImageKey();
            images.save(new ContentImage(toRequest, target.getId(), key, img.getStorageKey(), img.getMimeType(),
                    img.getSizeBytes(), now, userId));
            renamed.put(img.getImageKey(), key);
        }
        for (JsonNode card : tree.path("cards")) {
            JsonNode key = card.get("imageKey");
            if (key != null && key.isString() && card instanceof ObjectNode o) {
                String next = renamed.get(key.asString());
                if (next != null) {
                    o.put("imageKey", next);
                } else {
                    o.putNull("imageKey");
                }
            }
        }
        return write(tree);
    }

    // ------------------------------------------------------------------ request information / type

    /** Partial update of the request information (keys present in the body only). */
    public RequestDetail updateInfo(AuthUser auth, String id, JsonNode body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_REQUEST);
        if (body == null || !body.isObject()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED);
        }
        support.checkRowVersion(ctx, body.has("rowVersion") && !body.get("rowVersion").isNull()
                ? body.get("rowVersion").asLong() : null, false);
        RequestInfo cur = ctx.request().info();
        RequestInfo next = new RequestInfo(
                text(body, "title", cur.title(), TITLE_MAX, "제목"),
                date(body, "hopeDueDate", cur.hopeDueDate()),
                text(body, "purpose", cur.purpose(), limits.maxInfoTextLength(), "목적"),
                text(body, "target", cur.target(), limits.maxInfoTextLength(), "대상 고객"),
                text(body, "background", cur.background(), limits.maxInfoTextLength(), "배경"),
                text(body, "campaign", cur.campaign(), CAMPAIGN_MAX, "캠페인"),
                urgency(body, cur.urgency()));
        ctx.request().updateInfo(next, support.now());
        return support.detail(ctx);
    }

    /** Type change resets the draft to one blank content of the new type; attachments are removed. */
    public RequestDetail changeType(AuthUser auth, String id, ChangeTypeBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_REQUEST);
        support.checkRowVersion(ctx, body == null ? null : body.rowVersion(), false);
        if (body == null || body.type() == null || !contentTypes.isActive(body.type())) {
            throw BusinessException.validation("type", "사용 중인 유형만 선택할 수 있습니다");
        }
        Request r = ctx.request();
        if (r.getType() == body.type()) {
            return support.detail(ctx);
        }
        Instant now = support.now();
        r.changeType(body.type(), now);
        List<Content> current = support.currentContents(r.getId());
        for (int i = 0; i < current.size(); i++) {
            Content c = current.get(i);
            files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId()).forEach(ContentFile::markDeleted);
            if (i == 0) {
                c.reset("콘텐츠 " + c.keyNumber(), write(PayloadNormalizer.blank(body.type())), now);
            } else {
                c.markDeleted(now);
            }
        }
        if (current.isEmpty()) {
            int number = support.nextKeyNumber(r.getId());
            contents.save(new Content(r.getId(), "C" + number, "콘텐츠 " + number,
                    write(PayloadNormalizer.blank(body.type())), support.nextSortOrder(r.getId()), now));
        }
        support.log(r, ctx.userId(), "유형 변경", ContentTypeService.label(body.type()), null, null);
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ contents

    public ContentResponse addContent(AuthUser auth, String id, String title) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_REQUEST);
        Request r = ctx.request();
        if (support.currentContents(r.getId()).size() >= limits.maxContentsPerRequest()) {
            throw new BusinessException(ErrorCode.LIMIT_EXCEEDED,
                    String.format("콘텐츠는 요청당 최대 %,d건입니다", limits.maxContentsPerRequest()));
        }
        Content c = createContent(r, title, PayloadNormalizer.blank(r.getType()), support.now());
        support.log(r, ctx.userId(), "콘텐츠 추가", null, c);
        return assembler.content(c, support.now());
    }

    /** New content with the next unused key. Title defaults to "콘텐츠 n". */
    Content createContent(Request r, String title, JsonNode payload, Instant now) {
        int number = support.nextKeyNumber(r.getId());
        String t = title == null || title.isBlank() ? "콘텐츠 " + number : title.trim();
        if (t.length() > TITLE_MAX) {
            throw BusinessException.validation("title", "콘텐츠 제목은 최대 200자입니다");
        }
        Content c = new Content(r.getId(), "C" + number, t, write(payload), support.nextSortOrder(r.getId()), now);
        return contents.saveAndFlush(c);
    }

    public void deleteContent(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_REQUEST);
        Content c = support.content(ctx, key);
        if (support.currentContents(ctx.request().getId()).size() < 2) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "콘텐츠가 1건 이상 필요합니다");
        }
        Instant now = support.now();
        files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId()).forEach(ContentFile::markDeleted);
        c.markDeleted(now);
        support.log(ctx.request(), ctx.userId(), "콘텐츠 삭제", c.getTitle(), null, null);
    }

    /**
     * Draft autosave: title and payload are written as they are (no version), after the strict shape check and the
     * server caps. A save based on an older {@code savedAt} than the stored one is a VERSION_CONFLICT (another tab
     * saved first).
     */
    public ContentResponse saveDraft(AuthUser auth, String id, String key, SaveContentBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        support.requireDraft(ctx);
        Content c = support.content(ctx, key);
        if (body == null) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED);
        }
        if (body.expectedSavedAt() != null && c.getSavedAt() != null
                && c.getSavedAt().isAfter(body.expectedSavedAt())) {
            throw new BusinessException(ErrorCode.VERSION_CONFLICT,
                    "다른 탭에서 더 최신 내용이 저장되었습니다. 최신 내용을 다시 불러오세요");
        }
        String title = body.title() == null ? c.getTitle() : body.title();
        if (title.length() > TITLE_MAX) {
            throw BusinessException.validation("title", "콘텐츠 제목은 최대 200자입니다");
        }
        ObjectNode payload = normalizer.normalize(ctx.request().getType(), body.payload());
        requireOwnImages(ctx.request().getId(), payload);
        c.saveDraft(title, write(payload), support.now());
        contents.flush();
        return assembler.content(c, support.now());
    }

    void requireOwnImages(String requestId, JsonNode payload) {
        List<String> keys = PayloadNormalizer.imageKeys(payload);
        if (keys.isEmpty()) {
            return;
        }
        Set<String> known = new HashSet<>();
        images.findByRequestIdAndImageKeyIn(requestId, keys).forEach(i -> known.add(i.getImageKey()));
        int i = 0;
        for (JsonNode card : payload.path("cards")) {
            JsonNode k = card.get("imageKey");
            if (k != null && k.isString() && !known.contains(k.asString())) {
                throw BusinessException.validation("payload.cards." + i + ".imageKey", "등록되지 않은 이미지입니다");
            }
            i++;
        }
    }

    // ------------------------------------------------------------------ submit / cancel

    /**
     * Submit for review: full validation, then DRAFT → WAITING with round/version handling. A repeated submit with
     * the same {@code Idempotency-Key} returns the current state without another transition or round.
     */
    public RequestDetail submit(AuthUser auth, String id, Long rowVersion, String idempotencyKey) {
        Ctx ctx = support.lock(auth, id);
        Request r = ctx.request();
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey.trim();
        if (key != null && key.length() > 64) {
            throw BusinessException.validation("Idempotency-Key", "Idempotency-Key는 최대 64자입니다");
        }
        if (key != null && key.equals(r.getSubmitIdempotencyKey()) && r.getStatus() != RequestStatus.DRAFT
                && r.getRequesterId().equals(ctx.userId())) {
            return support.detail(ctx);
        }
        support.require(ctx, RequestAction.SUBMIT);
        support.checkRowVersion(ctx, rowVersion, true);

        List<Content> current = support.currentContents(r.getId());
        Map<Long, List<ContentFile>> filesByContent = new HashMap<>();
        current.forEach(c -> filesByContent.put(c.getId(),
                files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId())));
        SubmitValidator.Result result = submitValidator.validate(validationInput(ctx, current, filesByContent, true));
        if (!result.ok()) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, SubmitValidator.SUMMARY,
                    result.fieldErrors().isEmpty() ? null : result.fieldErrors(), result.details());
        }

        Instant now = support.now();
        boolean firstSubmit = r.getSubmittedAt() == null;
        r.submit(now, key);
        for (Content c : current) {
            snapshotOnSubmit(c, filesByContent.get(c.getId()), firstSubmit, ctx.userId(), now);
        }
        support.log(r, ctx.userId(), "검수 요청", "콘텐츠 " + current.size() + "건", null, null);
        Long lead = ctx.project().getLeadUserId();
        if (lead != null) {
            String due = r.getDueDate() == null ? "" : " (납기 " + r.getDueDate() + ")";
            notifications.notify(List.of(lead), NotificationKind.ASSIGN, r.getId(),
                    "신규 검수 요청이 배정을 기다립니다: " + r.getTitle() + due, ctx.userId());
        }
        return support.detail(ctx);
    }

    private void snapshotOnSubmit(Content c, List<ContentFile> fs, boolean firstSubmit, long userId, Instant now) {
        String filesJson = assembler.filesSnapshot(fs);
        ContentVersion last = firstSubmit ? null
                : contentVersions.findFirstByContentIdOrderByVersionDesc(c.getId()).orElse(null);
        JsonNode current = fingerprints.of(c.getTitle(), c.getPayload(), filesJson);
        JsonNode previous = last == null ? null
                : fingerprints.of(last.getTitle(), last.getPayload(), last.getFilesSnapshot());
        switch (SubmissionPlanner.versionStep(firstSubmit, current, previous)) {
            case START -> c.startVersioning(now);
            case BUMP -> c.bumpVersion(now);
            case SNAPSHOT -> {
                // keep the current version
            }
            case KEEP -> {
                return;
            }
        }
        contentVersions.save(new ContentVersion(c.getId(), c.getVersion(), c.getTitle(), c.getPayload(), filesJson,
                now, userId));
    }

    /**
     * Review completion re-check of the final contents: the submit rules on the current contents, without the
     * project/type activity checks (those only gate new submissions).
     */
    public SubmitValidator.Result validateFinalContents(Ctx ctx) {
        List<Content> current = support.currentContents(ctx.request().getId());
        Map<Long, List<ContentFile>> filesByContent = new HashMap<>();
        current.forEach(c -> filesByContent.put(c.getId(),
                files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId())));
        return submitValidator.validate(validationInput(ctx, current, filesByContent, false));
    }

    private SubmitValidator.Input validationInput(Ctx ctx, List<Content> current,
            Map<Long, List<ContentFile>> filesByContent, boolean checkActivity) {
        Request r = ctx.request();
        Project project = ctx.project();
        Map<Long, FileScanStatus> scan = new HashMap<>();
        List<ContentFile> all = filesByContent.values().stream().flatMap(List::stream).toList();
        if (!all.isEmpty()) {
            fileVersions.findByFileIdInOrderByVersionAsc(all.stream().map(ContentFile::getId).toList())
                    .forEach(v -> {
                        ContentFile f = all.stream().filter(x -> x.getId().equals(v.getFileId())).findFirst()
                                .orElse(null);
                        if (f != null && f.getCurrentVersion() == v.getVersion()) {
                            scan.put(f.getId(), v.getScanStatus());
                        }
                    });
        }
        List<SubmitValidator.ContentInput> inputs = new ArrayList<>();
        for (Content c : current) {
            List<SubmitValidator.FileInput> fileInputs = filesByContent.get(c.getId()).stream()
                    .map(f -> new SubmitValidator.FileInput(f.getName(), f.getTotalAmount(), f.getReviewAmount(),
                            f.getSizeBytes(), scan.get(f.getId()) == FileScanStatus.SAFE))
                    .toList();
            inputs.add(new SubmitValidator.ContentInput(c.getKey(), c.getTitle(), json.readTree(c.getPayload()),
                    fileInputs));
        }
        Set<String> templates = new HashSet<>();
        project.getTemplates().stream().map(ProjectTemplate::getCode).forEach(templates::add);
        return new SubmitValidator.Input(r.info(), r.getType(),
                !checkActivity || contentTypes.isActive(r.getType()), !checkActivity || project.isActive(),
                templates, new HashSet<>(project.getSenders()), variables.activeValues(project.getId()), inputs);
    }

    /** Cancel before assignment: back to draft, round kept, lead reviewer notified. */
    public RequestDetail cancel(AuthUser auth, String id, Long rowVersion) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.CANCEL);
        support.checkRowVersion(ctx, rowVersion, true);
        Request r = ctx.request();
        r.cancel(support.now());
        support.log(r, ctx.userId(), "요청 취소", null, null, null);
        Long lead = ctx.project().getLeadUserId();
        if (lead != null) {
            notifications.notify(List.of(lead), NotificationKind.INFO, r.getId(), r.getTitle() + " 요청이 취소되었습니다",
                    ctx.userId());
        }
        return support.detail(ctx);
    }

    // ------------------------------------------------------------------ helpers

    private RequestDetail detailOf(AuthUser auth, String id) {
        requests.flush();
        return queries.detail(auth, id);
    }

    private static void requireRequester(User user, Project project) {
        if (!project.rolesOf(user.getId()).contains(ProjectRole.REQUESTER)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "요청자 역할이 있어야 요청을 만들 수 있습니다");
        }
        if (!project.isActive()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "사용 중인 프로젝트에서 요청을 만드세요");
        }
    }

    private String write(JsonNode node) {
        return json.writeValueAsString(node);
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String text(JsonNode body, String key, String current, int max, String label) {
        if (!body.has(key)) {
            return current;
        }
        JsonNode v = body.get(key);
        if (v.isNull()) {
            return key.equals("title") ? "" : null;
        }
        if (!v.isString()) {
            throw BusinessException.validation(key, label + " 형식을 확인하세요");
        }
        String s = v.asString();
        if (s.length() > max) {
            String message = String.format("%s은(는) 최대 %,d자입니다", label, max);
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, message,
                    List.of(new ErrorResponse.FieldErrorItem(key, message)), null);
        }
        return s;
    }

    private static LocalDate date(JsonNode body, String key, LocalDate current) {
        if (!body.has(key)) {
            return current;
        }
        JsonNode v = body.get(key);
        if (v.isNull() || v.isString() && v.asString().isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v.asString());
        } catch (DateTimeParseException e) {
            throw BusinessException.validation(key, "희망 납기는 YYYY-MM-DD 형식으로 입력하세요");
        }
    }

    private static Urgency urgency(JsonNode body, Urgency current) {
        if (!body.has("urgency") || body.get("urgency").isNull()) {
            return current;
        }
        try {
            return Urgency.valueOf(body.get("urgency").asString());
        } catch (IllegalArgumentException e) {
            throw BusinessException.validation("urgency", "긴급도를 확인하세요");
        }
    }
}
