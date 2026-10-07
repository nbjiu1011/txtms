package com.txtms.domain.request.service;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.request.FileRangeBody;
import com.txtms.domain.request.dto.response.FileMeta;
import com.txtms.domain.request.dto.response.ImageResponse;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentFile;
import com.txtms.domain.request.entity.ContentFileVersion;
import com.txtms.domain.request.entity.ContentImage;
import com.txtms.domain.request.entity.FileScanStatus;
import com.txtms.domain.request.entity.FileUnit;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.file.FileInspector;
import com.txtms.domain.request.file.FileRejectedException;
import com.txtms.domain.request.file.MalwareScanner;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.repository.ContentFileVersionRepository;
import com.txtms.domain.request.repository.ContentImageRepository;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.service.RequestWriteSupport.Ctx;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;
import com.txtms.global.storage.FileStorage;

/**
 * Attachments and RCS card images. Each file is handled on its own: permission check → limits → type and signature
 * → malware scan → permission re-check and store. A blocked upload is not stored and leaves a {@code 파일 등록 차단}
 * history entry (written in its own transaction so it survives the rejection).
 */
@Service
public class AttachmentService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PERMISSION_CHANGED = "작업 중 권한이 변경되었습니다";
    private static final Map<String, String> MIME = Map.of(
            "pdf", "application/pdf",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "hwp", "application/x-hwp",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "txt", "text/plain",
            "png", "image/png",
            "jpg", "image/jpeg");

    private final RequestWriteSupport support;
    private final RequestQueryService queries;
    private final RequestAssembler assembler;
    private final ContentRepository contents;
    private final ContentFileRepository files;
    private final ContentFileVersionRepository fileVersions;
    private final ContentImageRepository images;
    private final FileStorage storage;
    private final MalwareScanner scanner;
    private final UserService userService;
    private final AuditLogService audit;
    private final AppProperties.Attachment limits;
    private final Duration lockTtl;
    private final TransactionTemplate tx;
    private final TransactionTemplate newTx;

    public AttachmentService(RequestWriteSupport support, RequestQueryService queries, RequestAssembler assembler,
            ContentRepository contents, ContentFileRepository files, ContentFileVersionRepository fileVersions,
            ContentImageRepository images, FileStorage storage, MalwareScanner scanner, UserService userService,
            AuditLogService audit, AppProperties properties, PlatformTransactionManager transactionManager) {
        this.support = support;
        this.queries = queries;
        this.assembler = assembler;
        this.contents = contents;
        this.files = files;
        this.fileVersions = fileVersions;
        this.images = images;
        this.storage = storage;
        this.scanner = scanner;
        this.userService = userService;
        this.audit = audit;
        this.limits = properties.attachment();
        this.lockTtl = properties.lock().ttl();
        this.tx = new TransactionTemplate(transactionManager);
        this.newTx = new TransactionTemplate(transactionManager);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Stored binary with its download name and media type. */
    public record Download(String name, String mimeType, byte[] content) {
    }

    /** A new random image key ({@code img_} + 16 hex). */
    public static String newImageKey() {
        byte[] b = new byte[8];
        RANDOM.nextBytes(b);
        return "img_" + HexFormat.of().formatHex(b);
    }

    // ------------------------------------------------------------------ upload / revision

    /** New attachment of a free-form content (draft, author). */
    public FileMeta upload(AuthUser auth, String id, String key, MultipartFile upload, String demoOutcome) {
        byte[] bytes = bytesOf(upload);
        String name = FileInspector.baseName(upload.getOriginalFilename());
        inTx(() -> {
            uploadContext(auth, id, key);
            return null;
        });
        return guarded(auth, id, key, () -> {
            inTx(() -> {
                checkLimits(uploadContext(auth, id, key).request(), bytes.length, null);
                return null;
            });
            String ext = FileInspector.inspect(name, bytes, limits.maxFileSize().toBytes());
            FileScanStatus scan = scan(bytes, demoOutcome);
            return inTx(() -> {
                Ctx ctx = recheck(() -> uploadContext(auth, id, key));
                Content c = support.content(ctx, key);
                checkLimits(ctx.request(), bytes.length, null);
                Instant now = support.now();
                FileUnit unit = FileUnit.ofExtension(ext).orElseThrow();
                int order = files.findByContentId(c.getId()).stream().mapToInt(ContentFile::getSortOrder).max()
                        .orElse(0) + 1;
                ContentFile f = files.save(new ContentFile(c.getId(), name, ext, unit, bytes.length, order, now,
                        ctx.userId()));
                if (unit == FileUnit.IMAGE) {
                    f.describeRange(1, 1, null);
                }
                fileVersions.save(new ContentFileVersion(f.getId(), 1, name, bytes.length, storage.store(bytes), scan,
                        now, ctx.userId()));
                support.log(ctx.request(), ctx.userId(), "파일 첨부", name + " v1", c);
                files.flush();
                return assembler.fileMeta(f);
            });
        });
    }

    /** Revised file by an assigned reviewer during review: same extension, same file id, version + 1. */
    public FileMeta uploadRevision(AuthUser auth, String id, String key, long fileId, MultipartFile upload,
            String demoOutcome) {
        byte[] bytes = bytesOf(upload);
        String name = FileInspector.baseName(upload.getOriginalFilename());
        ContentFile prior = inTx(() -> {
            Ctx ctx = revisionContext(auth, id, key);
            return fileOf(support.content(ctx, key), fileId);
        });
        return guarded(auth, id, key, () -> {
            inTx(() -> {
                checkLimits(revisionContext(auth, id, key).request(), bytes.length, prior);
                return null;
            });
            String ext = FileInspector.inspect(name, bytes, limits.maxFileSize().toBytes());
            if (!ext.equals(prior.getExt())) {
                throw new FileRejectedException("수정본은 " + prior.getExt() + " 형식이어야 합니다");
            }
            FileScanStatus scan = scan(bytes, demoOutcome);
            return inTx(() -> {
                Ctx ctx = recheck(() -> revisionContext(auth, id, key));
                Content c = support.content(ctx, key);
                ContentFile f = fileOf(c, fileId);
                checkLimits(ctx.request(), bytes.length, f);
                Instant now = support.now();
                f.addRevision(name, bytes.length);
                fileVersions.save(new ContentFileVersion(f.getId(), f.getCurrentVersion(), name, bytes.length,
                        storage.store(bytes), scan, now, ctx.userId()));
                support.log(ctx.request(), ctx.userId(), "파일 수정본 등록", name + " v" + f.getCurrentVersion(), c);
                files.flush();
                return assembler.fileMeta(f);
            });
        });
    }

    /** RCS card image (PNG/JPG, signature checked, scanned). Not counted in the attachment limits. */
    public ImageResponse uploadImage(AuthUser auth, String id, String key, MultipartFile upload, String demoOutcome) {
        byte[] bytes = bytesOf(upload);
        String name = FileInspector.baseName(upload.getOriginalFilename());
        inTx(() -> imageContext(auth, id, key));
        return guarded(auth, id, key, () -> {
            String ext = FileInspector.extensionOf(name);
            if (!FileInspector.IMAGES.contains(ext)) {
                throw new FileRejectedException("PNG/JPG 이미지를 선택하세요");
            }
            if (bytes.length > limits.maxImageSize().toBytes()) {
                throw new FileRejectedException("이미지는 최대 " + limits.maxImageSize().toMegabytes() + "MB입니다");
            }
            FileInspector.checkSignature(ext, bytes);
            scan(bytes, demoOutcome);
            return inTx(() -> {
                Ctx ctx = recheck(() -> imageContext(auth, id, key));
                Content c = support.content(ctx, key);
                String imageKey = newImageKey();
                images.save(new ContentImage(ctx.request().getId(), c.getId(), imageKey, storage.store(bytes),
                        MIME.get(ext), bytes.length, support.now(), ctx.userId()));
                return new ImageResponse(imageKey);
            });
        });
    }

    // ------------------------------------------------------------------ amounts / delete

    public FileMeta updateRange(AuthUser auth, String id, String key, long fileId, FileRangeBody body) {
        return inTx(() -> {
            Ctx ctx = draftContext(auth, id);
            ContentFile f = fileOf(support.content(ctx, key), fileId);
            if (body == null) {
                throw new BusinessException(ErrorCode.VALIDATION_FAILED);
            }
            applyRange(f, body.totalAmount(), body.reviewAmount(), body.rangeNote(), "");
            files.flush();
            return assembler.fileMeta(f);
        });
    }

    /**
     * Total amount, review amount and range note of an attachment (null amounts = not entered yet; PNG/JPG always
     * 1/1). Used by the draft PATCH and by revisions in review. {@code fieldPrefix} prefixes the error fields.
     */
    static void applyRange(ContentFile f, Integer total, Integer review, String rangeNote, String fieldPrefix) {
        String note = rangeNote == null ? null : rangeNote.trim();
        if (note != null && note.length() > 200) {
            throw BusinessException.validation(fieldPrefix + "rangeNote", "범위 설명은 최대 200자입니다");
        }
        if (f.getUnit() == FileUnit.IMAGE) {
            f.describeRange(1, 1, note);
        } else {
            f.describeRange(amount(total, fieldPrefix + "totalAmount"), amount(review, fieldPrefix + "reviewAmount"),
                    note);
        }
    }

    public void delete(AuthUser auth, String id, String key, long fileId) {
        inTx(() -> {
            Ctx ctx = draftContext(auth, id);
            Content c = support.content(ctx, key);
            ContentFile f = fileOf(c, fileId);
            f.markDeleted();
            support.log(ctx.request(), ctx.userId(), "파일 삭제", f.getName(), c);
            return null;
        });
    }

    // ------------------------------------------------------------------ downloads

    /** Any stored version of an attachment of a visible request. Audited as {@code 파일 다운로드}. */
    public Download download(AuthUser auth, String id, String key, long fileId, int version) {
        return inTx(() -> {
            User user = userService.require(auth.userId());
            Actor actor = userService.actorOf(user);
            ScopedRequest s = queries.requireVisible(actor, id);
            Content c = contents.findByRequestIdAndKey(s.request().getId(), key)
                    .orElseThrow(BusinessException::notFound);
            ContentFile f = files.findById(fileId).filter(x -> x.getContentId().equals(c.getId()))
                    .orElseThrow(BusinessException::notFound);
            ContentFileVersion v = fileVersions.findByFileIdAndVersion(f.getId(), version)
                    .filter(x -> x.getScanStatus() == FileScanStatus.SAFE)
                    .orElseThrow(BusinessException::notFound);
            byte[] bytes = storage.read(v.getStorageKey()).orElseThrow(() -> new BusinessException(
                    ErrorCode.NOT_FOUND, "시연 파일의 원본이 없습니다. 직접 첨부한 파일을 다운로드할 수 있습니다."));
            audit.record(user.getId(), s.project().customerId(), "파일 다운로드", s.request().getId(),
                    v.getName() + " v" + v.getVersion());
            return new Download(v.getName(), MIME.getOrDefault(f.getExt(), "application/octet-stream"), bytes);
        });
    }

    /** Card image of a visible request. */
    public Download image(AuthUser auth, String id, String imageKey) {
        return inTx(() -> {
            User user = userService.require(auth.userId());
            ScopedRequest s = queries.requireVisible(userService.actorOf(user), id);
            ContentImage img = images.findByImageKey(imageKey)
                    .filter(i -> i.getRequestId().equals(s.request().getId()))
                    .orElseThrow(BusinessException::notFound);
            byte[] bytes = storage.read(img.getStorageKey()).orElseThrow(BusinessException::notFound);
            return new Download(img.getImageKey(), img.getMimeType(), bytes);
        });
    }

    // ------------------------------------------------------------------ contexts and checks

    /** New attachment: draft, author, free-form only. */
    private Ctx uploadContext(AuthUser auth, String id, String key) {
        Ctx ctx = draftContext(auth, id);
        if (ctx.request().getType() != ContentType.FREEFORM) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "자유입력형 콘텐츠에만 파일을 첨부할 수 있습니다");
        }
        support.content(ctx, key);
        return ctx;
    }

    private Ctx draftContext(AuthUser auth, String id) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        support.requireDraft(ctx);
        return ctx;
    }

    /** File revision: in review, assigned reviewer, content not locked by someone else. */
    private Ctx revisionContext(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.REVIEW);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        if (ctx.request().getType() != ContentType.FREEFORM) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "자유입력형 콘텐츠에만 파일을 첨부할 수 있습니다");
        }
        requireNotLockedByOther(ctx, support.content(ctx, key));
        return ctx;
    }

    /** Card image: whoever may edit the content now (author in draft or answering, assigned reviewer in review). */
    private Ctx imageContext(AuthUser auth, String id, String key) {
        Ctx ctx = support.lock(auth, id);
        support.require(ctx, RequestAction.EDIT_CONTENT);
        if (ctx.request().getType() != ContentType.RCS) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "RCS 콘텐츠에만 이미지를 올릴 수 있습니다");
        }
        Content c = support.content(ctx, key);
        if (ctx.request().getStatus() != RequestStatus.DRAFT) {
            requireNotLockedByOther(ctx, c);
        }
        return ctx;
    }

    private void requireNotLockedByOther(Ctx ctx, Content c) {
        if (c.lockedByOther(ctx.userId(), support.now(), lockTtl)) {
            throw new BusinessException(ErrorCode.LOCKED_BY_OTHER);
        }
    }

    /** Count and size limits of the request's attachments (a revision replaces {@code replacing}). */
    private void checkLimits(Request r, long size, ContentFile replacing) {
        List<ContentFile> all = support.currentContents(r.getId()).stream()
                .flatMap(c -> files.findByContentIdAndDeletedFalseOrderBySortOrderAsc(c.getId()).stream())
                .toList();
        long total = all.stream().mapToLong(ContentFile::getSizeBytes).sum() + size
                - (replacing == null ? 0 : replacing.getSizeBytes());
        int count = all.size() + (replacing == null ? 1 : 0);
        if (size > limits.maxFileSize().toBytes() || count > limits.maxCount()
                || total > limits.maxTotalSize().toBytes()) {
            throw new FileRejectedException(String.format("파일당 %dMB, 요청당 최대 %d개·총 %dMB입니다",
                    limits.maxFileSize().toMegabytes(), limits.maxCount(), limits.maxTotalSize().toMegabytes()));
        }
    }

    private FileScanStatus scan(byte[] bytes, String demoOutcome) {
        FileScanStatus status = scanner.scan(bytes, demoOutcome);
        return switch (status) {
            case SAFE -> status;
            case UNSAFE -> throw new FileRejectedException(ErrorCode.FILE_UNSAFE, "위험 파일 검사 결과: 등록할 수 없습니다");
            case FAILED, PENDING -> throw new FileRejectedException(ErrorCode.FILE_SCAN_FAILED,
                    demoOutcome != null && !demoOutcome.isBlank()
                            ? "검사 서비스 실패 시연: 등록할 수 없습니다"
                            : "검사 서비스 실패: 등록할 수 없습니다");
        };
    }

    /** Current (not deleted) attachment of the content. */
    private ContentFile fileOf(Content c, long fileId) {
        return files.findById(fileId).filter(f -> f.getContentId().equals(c.getId()) && !f.isDeleted())
                .orElseThrow(BusinessException::notFound);
    }

    private static Integer amount(Integer value, String field) {
        if (value == null) {
            return null;
        }
        if (value < 0 || value > 1_000_000) {
            throw BusinessException.validation(field, "분량은 0 이상 1,000,000 이하의 정수로 입력하세요");
        }
        return value;
    }

    private static byte[] bytesOf(MultipartFile upload) {
        if (upload == null || upload.isEmpty()) {
            throw new FileRejectedException("파일을 선택하세요");
        }
        try {
            return upload.getBytes();
        } catch (IOException e) {
            throw new FileRejectedException("파일을 읽지 못했습니다");
        }
    }

    /** Permission checked again after the (slow) scan; a change is reported as {@code 작업 중 권한이 변경되었습니다}. */
    private static Ctx recheck(Supplier<Ctx> check) {
        try {
            return check.get();
        } catch (BusinessException e) {
            if (e.getCode() == ErrorCode.REQUEST_STATE_CONFLICT || e.getCode() == ErrorCode.NOT_FOUND
                    || e.getCode() == ErrorCode.FORBIDDEN || e.getCode() == ErrorCode.DRAFT_PRIVATE
                    || e.getCode() == ErrorCode.LOCKED_BY_OTHER) {
                throw new UploadBlockedException(e.getCode(), PERMISSION_CHANGED);
            }
            throw e;
        }
    }

    /** Runs the upload steps; a rejected upload is logged as {@code 파일 등록 차단} and the error rethrown. */
    private <T> T guarded(AuthUser auth, String id, String key, Supplier<T> steps) {
        try {
            return steps.get();
        } catch (FileRejectedException | UploadBlockedException e) {
            try {
                newTx.executeWithoutResult(status -> {
                    Request r = support.lock(auth, id).request();
                    Content c = contents.findByRequestIdAndKey(r.getId(), key).orElse(null);
                    support.log(r, auth.userId(), "파일 등록 차단", e.getMessage(), c);
                });
            } catch (BusinessException hidden) {
                // the request is no longer visible to the user: nothing to record on it
            }
            throw e;
        }
    }

    private <T> T inTx(Supplier<T> work) {
        return tx.execute(status -> work.get());
    }

    /** Permission or state changed while the file was being checked. */
    static final class UploadBlockedException extends BusinessException {
        UploadBlockedException(ErrorCode code, String message) {
            super(code, message);
        }
    }
}
