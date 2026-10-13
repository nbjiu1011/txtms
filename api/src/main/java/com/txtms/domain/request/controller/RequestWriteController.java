package com.txtms.domain.request.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.request.AddContentBody;
import com.txtms.domain.request.dto.request.BulkCommitBody;
import com.txtms.domain.request.dto.request.ChangeTypeBody;
import com.txtms.domain.request.dto.request.CreateRequestBody;
import com.txtms.domain.request.dto.request.FileRangeBody;
import com.txtms.domain.request.dto.request.SaveContentBody;
import com.txtms.domain.request.dto.request.WorkflowBody;
import com.txtms.domain.request.dto.response.BulkPreviewResponse;
import com.txtms.domain.request.dto.response.ContentResponse;
import com.txtms.domain.request.dto.response.CorrectionResponses.SubmitCheck;
import com.txtms.domain.request.dto.response.FileMeta;
import com.txtms.domain.request.dto.response.ImageResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.service.AttachmentService;
import com.txtms.domain.request.service.BulkImportService;
import com.txtms.domain.request.service.RequestCommandService;
import com.txtms.domain.request.service.RequestDeletionService;
import com.txtms.global.common.Downloads;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.JsonNode;

/** Request authoring writes: request, contents, attachments, images, XLSX bulk registration, submit and cancel. */
@RestController
public class RequestWriteController {

    static final String DEMO_SCAN_HEADER = "X-Demo-Scan-Outcome";

    private final RequestCommandService commands;
    private final AttachmentService attachments;
    private final BulkImportService bulk;
    private final RequestDeletionService deletion;

    public RequestWriteController(RequestCommandService commands, AttachmentService attachments,
            BulkImportService bulk, RequestDeletionService deletion) {
        this.commands = commands;
        this.attachments = attachments;
        this.bulk = bulk;
        this.deletion = deletion;
    }

    // ------------------------------------------------------------------ requests

    @PostMapping("/api/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDetail create(@AuthenticationPrincipal AuthUser auth, @RequestBody CreateRequestBody body) {
        return commands.create(auth, body);
    }

    @PatchMapping("/api/requests/{id}")
    public RequestDetail update(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody JsonNode body) {
        return commands.updateInfo(auth, id, body);
    }

    @PutMapping("/api/requests/{id}/type")
    public RequestDetail changeType(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody ChangeTypeBody body) {
        return commands.changeType(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDetail cloneRequest(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        return commands.cloneRequest(auth, id);
    }

    @PostMapping("/api/requests/{id}/submit")
    public RequestDetail submit(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody WorkflowBody body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return commands.submit(auth, id, body == null ? null : body.rowVersion(), idempotencyKey);
    }

    @PostMapping("/api/requests/{id}/submit-check")
    public SubmitCheck submitCheck(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        return commands.submitCheck(auth, id);
    }

    /** Requester deletes a draft that was never submitted (contract §21). */
    @DeleteMapping("/api/requests/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        deletion.delete(auth, id);
    }

    @PostMapping("/api/requests/{id}/cancel")
    public RequestDetail cancel(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody WorkflowBody body) {
        return commands.cancel(auth, id, body == null ? null : body.rowVersion());
    }

    // ------------------------------------------------------------------ contents

    @PostMapping("/api/requests/{id}/contents")
    @ResponseStatus(HttpStatus.CREATED)
    public ContentResponse addContent(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) AddContentBody body) {
        return commands.addContent(auth, id, body == null ? null : body.title());
    }

    @DeleteMapping("/api/requests/{id}/contents/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteContent(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key) {
        commands.deleteContent(auth, id, key);
    }

    @PutMapping("/api/requests/{id}/contents/{key}")
    public ContentResponse saveContent(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @RequestBody SaveContentBody body) {
        return commands.saveDraft(auth, id, key, body);
    }

    // ------------------------------------------------------------------ attachments

    @PostMapping("/api/requests/{id}/contents/{key}/files")
    @ResponseStatus(HttpStatus.CREATED)
    public FileMeta upload(@AuthenticationPrincipal AuthUser auth, @PathVariable String id, @PathVariable String key,
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = DEMO_SCAN_HEADER, required = false) String demoOutcome) {
        return attachments.upload(auth, id, key, file, demoOutcome);
    }

    @PostMapping("/api/requests/{id}/contents/{key}/files/{fileId}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public FileMeta uploadRevision(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @PathVariable long fileId, @RequestParam("file") MultipartFile file,
            @RequestHeader(value = DEMO_SCAN_HEADER, required = false) String demoOutcome) {
        return attachments.uploadRevision(auth, id, key, fileId, file, demoOutcome);
    }

    @PatchMapping("/api/requests/{id}/contents/{key}/files/{fileId}")
    public FileMeta updateRange(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @PathVariable long fileId, @RequestBody FileRangeBody body) {
        return attachments.updateRange(auth, id, key, fileId, body);
    }

    @DeleteMapping("/api/requests/{id}/contents/{key}/files/{fileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(@AuthenticationPrincipal AuthUser auth, @PathVariable String id, @PathVariable String key,
            @PathVariable long fileId) {
        attachments.delete(auth, id, key, fileId);
    }

    @GetMapping("/api/requests/{id}/contents/{key}/files/{fileId}/versions/{version}/download")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @PathVariable long fileId, @PathVariable int version) {
        AttachmentService.Download d = attachments.download(auth, id, key, fileId, version);
        return Downloads.attachment(d.name(), d.mimeType(), d.content());
    }

    @PostMapping("/api/requests/{id}/contents/{key}/images")
    @ResponseStatus(HttpStatus.CREATED)
    public ImageResponse uploadImage(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @RequestParam("file") MultipartFile file,
            @RequestHeader(value = DEMO_SCAN_HEADER, required = false) String demoOutcome) {
        return attachments.uploadImage(auth, id, key, file, demoOutcome);
    }

    @GetMapping("/api/requests/{id}/images/{imageKey}")
    public ResponseEntity<byte[]> image(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String imageKey) {
        AttachmentService.Download d = attachments.image(auth, id, imageKey);
        return Downloads.inline(d.mimeType(), d.content());
    }

    // ------------------------------------------------------------------ XLSX bulk registration

    @GetMapping("/api/content-types/{type}/bulk-template")
    public ResponseEntity<byte[]> bulkTemplate(@PathVariable ContentType type) {
        BulkImportService.Template t = bulk.template(type);
        return Downloads.attachment(t.fileName(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", t.content());
    }

    @PostMapping("/api/requests/{id}/bulk-import/preview")
    public BulkPreviewResponse bulkPreview(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestParam("file") MultipartFile file) {
        return bulk.preview(auth, id, file);
    }

    @PostMapping("/api/requests/{id}/bulk-import/commit")
    public RequestDetail bulkCommit(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody BulkCommitBody body) {
        return bulk.commit(auth, id, body);
    }
}
