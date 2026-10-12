package com.txtms.domain.request.service;

import java.io.IOException;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.txtms.domain.request.entity.CompletionBundle;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.ContentFileVersion;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.CompletionBundleRepository;
import com.txtms.domain.request.repository.ContentFileVersionRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;
import com.txtms.global.storage.FileStorage;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Exports of a finally completed request: the XLSX of the completed contents, the ZIP of the final attachments with
 * the version manifest, and the audit of copied texts. Every export re-checks visibility and the final status and
 * is audited with the customer id.
 */
@Service
public class BundleExportService {

    static final String MANIFEST = "완료_버전_명세.json";

    private final RequestQueryService queries;
    private final RequestPolicy policy;
    private final UserService userService;
    private final CompletionBundleRepository bundles;
    private final CompletionBundleItemRepository bundleItems;
    private final ContentFileVersionRepository fileVersions;
    private final FileStorage storage;
    private final AuditLogService audit;
    private final JsonMapper json;
    private final TransactionTemplate tx;

    public BundleExportService(RequestQueryService queries, RequestPolicy policy, UserService userService,
            CompletionBundleRepository bundles, CompletionBundleItemRepository bundleItems,
            ContentFileVersionRepository fileVersions, FileStorage storage,
            AuditLogService audit, JsonMapper json, PlatformTransactionManager transactionManager) {
        this.queries = queries;
        this.policy = policy;
        this.userService = userService;
        this.bundles = bundles;
        this.bundleItems = bundleItems;
        this.fileVersions = fileVersions;
        this.storage = storage;
        this.audit = audit;
        this.json = json;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** A generated file and its download name. */
    public record Export(String fileName, byte[] content) {
    }

    /** One attachment of the ZIP: the frozen file version and where it goes. */
    public record ZipFile(String contentKey, int contentVersion, long fileId, String fileName, int fileVersion,
            String path, String storageKey, long sizeBytes, String unit, Integer totalAmount, Integer reviewAmount,
            String rangeNote) {
    }

    /** Everything needed to stream the ZIP after the checks and the audit were committed. */
    public record ZipPlan(String fileName, String requestId, RequestStatus status, Instant completedAt,
            List<ZipFile> files) {
    }

    private record Scope(User user, ScopedRequest request, CompletionBundle bundle, List<CompletionBundleItem> items) {
    }

    // ------------------------------------------------------------------ XLSX

    public Export exportXlsx(AuthUser auth, String id) {
        return tx.execute(status -> {
            Scope s = finalScope(auth, id);
            List<List<String>> rows = new ArrayList<>();
            for (CompletionBundleItem item : s.items()) {
                rows.add(BundleSheet.row(s.request().request().getType(), item.getContentKey(), item.getTitle(),
                        item.getVersion(), json.readTree(item.getPayload()), s.bundle().getStatus(),
                        s.bundle().getCompletedAt()));
            }
            byte[] bytes = BundleSheet.workbook(rows);
            audit.record(s.user().getId(), s.request().project().customerId(), "완료본 반출",
                    s.request().request().getId(), "XLSX");
            return new Export(s.request().request().getId() + "_완료본.xlsx", bytes);
        });
    }

    // ------------------------------------------------------------------ ZIP

    /**
     * Checks and audits the attachment export. Every frozen file version must still have its stored object;
     * otherwise the whole ZIP is refused (seeded demo files have no originals).
     */
    public ZipPlan prepareZip(AuthUser auth, String id) {
        return tx.execute(status -> {
            Scope s = finalScope(auth, id);
            List<ZipFile> zipFiles = new ArrayList<>();
            Set<String> paths = new HashSet<>();
            for (CompletionBundleItem item : s.items()) {
                for (JsonNode meta : json.readTree(item.getFilesSnapshot())) {
                    long fileId = meta.path("id").asLong();
                    int version = meta.path("version").asInt(1);
                    String name = meta.path("name").asString();
                    ContentFileVersion v = fileVersions.findByFileIdAndVersion(fileId, version).orElse(null);
                    if (v == null || !storage.exists(v.getStorageKey())) {
                        throw new BusinessException(ErrorCode.NOT_FOUND, name + ": 시연용 파일의 원본이 없습니다");
                    }
                    String path = uniquePath(item.getContentKey() + "/v" + version + "_" + safeName(name), paths);
                    zipFiles.add(new ZipFile(item.getContentKey(), item.getVersion(), fileId, name, version, path,
                            v.getStorageKey(), v.getSizeBytes(), meta.path("unit").asString(),
                            intOrNull(meta.get("totalAmount")), intOrNull(meta.get("reviewAmount")),
                            meta.path("rangeNote").isString() ? meta.path("rangeNote").asString() : null));
                }
            }
            String requestId = s.request().request().getId();
            audit.record(s.user().getId(), s.request().project().customerId(), "첨부 반출", requestId, "ZIP");
            return new ZipPlan(requestId + "_첨부_완료본.zip", requestId, s.bundle().getStatus(),
                    s.bundle().getCompletedAt(), zipFiles);
        });
    }

    /** Streams the ZIP: each file read and written in turn, then the manifest with sizes and SHA-256 digests. */
    public void writeZip(ZipPlan plan, OutputStream out) throws IOException {
        List<Map<String, Object>> manifestFiles = new ArrayList<>();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (ZipFile f : plan.files()) {
                byte[] bytes = storage.read(f.storageKey())
                        .orElseThrow(() -> new IOException("Stored object disappeared: " + f.storageKey()));
                zip.putNextEntry(new ZipEntry(f.path()));
                zip.write(bytes);
                zip.closeEntry();
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("contentKey", f.contentKey());
                entry.put("contentVersion", f.contentVersion());
                entry.put("fileId", f.fileId());
                entry.put("fileName", f.fileName());
                entry.put("fileVersion", f.fileVersion());
                entry.put("path", f.path());
                entry.put("sizeBytes", (long) bytes.length);
                entry.put("sha256", sha256(bytes));
                entry.put("unit", f.unit());
                entry.put("totalAmount", f.totalAmount());
                entry.put("reviewAmount", f.reviewAmount());
                entry.put("rangeNote", f.rangeNote());
                manifestFiles.add(entry);
            }
            Map<String, Object> manifest = new LinkedHashMap<>();
            manifest.put("requestId", plan.requestId());
            manifest.put("status", plan.status().name());
            manifest.put("completedAt", plan.completedAt().toString());
            manifest.put("completedDate", CompletionBundles.completedDate(plan.completedAt()));
            manifest.put("files", manifestFiles);
            zip.putNextEntry(new ZipEntry(MANIFEST));
            zip.write(json.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest));
            zip.closeEntry();
            zip.finish();
        }
    }

    // ------------------------------------------------------------------ copy events

    /**
     * A user copied a completed content text: audited as an export ({@code 완료본 반출}, {@code 문안 복사 {키}}). Only
     * finally completed requests are exported (EXPORT, otherwise {@code REQUEST_STATE_CONFLICT}) and the key must be
     * an item of their completion bundle. Copying a draft or in-progress text is not an export of a completed
     * original and is not audited as one.
     */
    public void recordCopy(AuthUser auth, String id, String contentKey) {
        tx.executeWithoutResult(status -> {
            User user = userService.require(auth.userId());
            Actor actor = userService.actorOf(user);
            ScopedRequest s = queries.requireVisible(actor, id);
            policy.require(actor, s.project(), s.facts(), RequestAction.EXPORT);
            if (contentKey == null || contentKey.isBlank()) {
                throw BusinessException.validation("contentKey", "복사한 콘텐츠를 지정하세요");
            }
            String key = contentKey.trim();
            boolean known = bundleItems.findByRequestIdOrderBySortOrderAsc(s.request().getId()).stream()
                    .anyMatch(i -> i.getContentKey().equals(key));
            if (!known) {
                throw BusinessException.notFound();
            }
            audit.record(user.getId(), s.project().customerId(), "완료본 반출", s.request().getId(), "문안 복사 " + key);
        });
    }

    // ------------------------------------------------------------------ helpers

    /** Visible, finally completed request (EXPORT) with its bundle. */
    private Scope finalScope(AuthUser auth, String id) {
        User user = userService.require(auth.userId());
        Actor actor = userService.actorOf(user);
        ScopedRequest s = queries.requireVisible(actor, id);
        policy.require(actor, s.project(), s.facts(), RequestAction.EXPORT);
        CompletionBundle bundle = bundles.findById(s.request().getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT));
        return new Scope(user, s, bundle, bundleItems.findByRequestIdOrderBySortOrderAsc(s.request().getId()));
    }

    /**
     * File name safe inside a ZIP path: {@code \ / : * ? " < > |} and control characters become {@code _}, so an
     * entry can never leave its {@code {콘텐츠키}/v{n}_} folder or break extraction (no zip slip).
     */
    static String safeName(String name) {
        return name == null || name.isEmpty() ? "_" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
    }

    private static String uniquePath(String path, Set<String> used) {
        String candidate = path;
        int n = 2;
        while (!used.add(candidate)) {
            int dot = path.lastIndexOf('.');
            int slash = path.lastIndexOf('/');
            candidate = dot > slash ? path.substring(0, dot) + " (" + n + ")" + path.substring(dot)
                    : path + " (" + n + ")";
            n++;
        }
        return candidate;
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Integer intOrNull(JsonNode n) {
        return n == null || n.isNull() ? null : n.asInt();
    }
}
