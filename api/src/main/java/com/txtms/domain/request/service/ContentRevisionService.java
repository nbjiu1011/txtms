package com.txtms.domain.request.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.request.dto.request.RevisionBody;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentFile;
import com.txtms.domain.request.entity.ContentVersion;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.repository.ContentVersionRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.request.validation.PayloadNormalizer;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Saved revisions of submitted requests (assigned reviewers in review, the requester while answering). The editor
 * must hold a valid lock and base the revision on the current version. Only a real change opens a new version with
 * a snapshot (payload and attachments as they are now, including file revisions uploaded since the last version).
 * The lock is released after saving, changed or not.
 */
@Service
@Transactional
public class ContentRevisionService {

    static final String LOCK_EXPIRED = "편집 잠금이 만료되었습니다. 최신 버전을 다시 불러오세요";

    private final RequestWriteSupport support;
    private final RequestAssembler assembler;
    private final RequestCommandService commands;
    private final ContentLockService locks;
    private final ContentFileRepository files;
    private final ContentVersionRepository contentVersions;
    private final ContentFingerprint fingerprints;
    private final PayloadNormalizer normalizer;
    private final JsonMapper json;
    private final Duration ttl;

    public ContentRevisionService(RequestWriteSupport support, RequestAssembler assembler,
            RequestCommandService commands, ContentLockService locks, ContentFileRepository files,
            ContentVersionRepository contentVersions, ContentFingerprint fingerprints, PayloadNormalizer normalizer,
            JsonMapper json, AppProperties properties) {
        this.support = support;
        this.assembler = assembler;
        this.commands = commands;
        this.locks = locks;
        this.files = files;
        this.contentVersions = contentVersions;
        this.fingerprints = fingerprints;
        this.normalizer = normalizer;
        this.json = json;
        this.ttl = properties.lock().ttl();
    }

    public ContentResponse save(AuthUser auth, String id, String key, RevisionBody body) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        ContentLockService.requireSubmitted(ctx);
        Content c = support.content(ctx, key);
        if (body == null || body.baseVersion() == null) {
            throw BusinessException.validation("baseVersion", "baseVersion이 필요합니다");
        }
        Instant now = support.now();
        switch (EditLocks.state(c.getLockUserId(), c.getLockAt(), ctx.userId(), now, ttl)) {
            case OTHER -> throw locks.lockedByOther(c.getLockUserId());
            case FREE, EXPIRED -> throw new BusinessException(ErrorCode.LOCKED_BY_OTHER, LOCK_EXPIRED);
            case MINE -> {
                // the editor holds the lock
            }
        }
        if (body.baseVersion() != c.getVersion()) {
            throw new BusinessException(ErrorCode.VERSION_CONFLICT, "v" + body.baseVersion()
                    + "을 기준으로 수정했지만 지금 최신 버전은 v" + c.getVersion() + "입니다. 덮어쓰지 않도록 저장을 막았습니다.");
        }
        if (body.title() != null && !body.title().equals(c.getTitle())) {
            throw BusinessException.validation("title", "콘텐츠 제목은 작성 중에만 바꿀 수 있습니다");
        }
        Request r = ctx.request();
        ObjectNode payload = normalizer.normalize(r.getType(), body.payload());
        commands.requireOwnImages(r.getId(), payload);
        String payloadJson = json.writeValueAsString(payload);

        List<ContentFile> fs = files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId());
        String filesBefore = assembler.filesSnapshot(fs);
        applyRanges(fs, body.files());
        String filesAfter = assembler.filesSnapshot(fs);

        ContentVersion last = contentVersions.findFirstByContentIdOrderByVersionDesc(c.getId()).orElse(null);
        Object baseline = last != null
                ? fingerprints.of(last.getTitle(), last.getPayload(), last.getFilesSnapshot())
                : fingerprints.of(c.getTitle(), c.getPayload(), filesBefore);
        RevisionPlanner.Outcome outcome = RevisionPlanner.plan(r.getStatus(),
                fingerprints.of(c.getTitle(), payloadJson, filesAfter), baseline,
                fingerprints.text(c.getTitle(), payloadJson), fingerprints.text(c.getTitle(), c.getPayload()));

        c.releaseLock();
        if (outcome.changed()) {
            int previous = c.getVersion();
            c.applyRevision(c.getTitle(), payloadJson, now);
            contentVersions.save(new ContentVersion(c.getId(), c.getVersion(), c.getTitle(), payloadJson, filesAfter,
                    now, ctx.userId()));
            boolean answering = r.getStatus() == RequestStatus.CONFIRMING;
            support.log(r, ctx.userId(), answering ? "문안 수정 (확인 응답 중)" : "문안 수정",
                    "v" + previous + " → v" + c.getVersion(), c);
            if (outcome.markAnswerChanged()) {
                r.markAnswerChanged();
            }
        }
        files.flush();
        return assembler.content(c, now);
    }

    /** Attachment amounts edited in the revision buffer (files of this content only, each at most once). */
    private static void applyRanges(List<ContentFile> fs, List<RevisionBody.FileRange> ranges) {
        if (ranges == null) {
            return;
        }
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < ranges.size(); i++) {
            RevisionBody.FileRange range = ranges.get(i);
            String prefix = "files." + i + ".";
            if (range == null || range.fileId() == null || !seen.add(range.fileId())) {
                throw BusinessException.validation(prefix + "fileId", "첨부파일을 확인하세요");
            }
            ContentFile f = fs.stream().filter(x -> x.getId().equals(range.fileId())).findFirst()
                    .orElseThrow(() -> BusinessException.validation(prefix + "fileId", "첨부파일을 확인하세요"));
            AttachmentService.applyRange(f, range.totalAmount(), range.reviewAmount(), range.rangeNote(), prefix);
        }
    }
}
