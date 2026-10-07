package com.txtms.domain.request.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.request.dto.request.CopyEventBody;
import com.txtms.domain.request.dto.request.FollowUpBody;
import com.txtms.domain.request.dto.request.ReviseBody;
import com.txtms.domain.request.dto.request.WorkflowBody;
import com.txtms.domain.request.dto.response.AssignmentChangeResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.service.BundleExportService;
import com.txtms.domain.request.service.CompletionService;
import com.txtms.domain.request.service.RequestCommandService;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.global.common.Downloads;
import com.txtms.global.security.AuthUser;

import jakarta.servlet.http.HttpServletResponse;

/** Completion, approval, revision request, completed-content exports, follow-ups and assignment changes. */
@RestController
public class CompletionController {

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final CompletionService completion;
    private final BundleExportService exports;
    private final RequestCommandService commands;
    private final RequestQueryService queries;

    public CompletionController(CompletionService completion, BundleExportService exports,
            RequestCommandService commands, RequestQueryService queries) {
        this.completion = completion;
        this.exports = exports;
        this.commands = commands;
        this.queries = queries;
    }

    // ------------------------------------------------------------------ workflow

    @PostMapping("/api/requests/{id}/complete")
    public RequestDetail complete(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) WorkflowBody body) {
        return completion.complete(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/approve")
    public RequestDetail approve(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) WorkflowBody body) {
        return completion.approve(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/revise")
    public RequestDetail revise(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) ReviseBody body) {
        return completion.revise(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/follow-up")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDetail followUp(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) FollowUpBody body) {
        return commands.followUp(auth, id, body);
    }

    @GetMapping("/api/requests/{id}/assignment-changes")
    public List<AssignmentChangeResponse> assignmentChanges(@AuthenticationPrincipal AuthUser auth,
            @PathVariable String id) {
        return queries.assignmentChanges(auth, id);
    }

    // ------------------------------------------------------------------ exports

    @GetMapping("/api/requests/{id}/bundle/export.xlsx")
    public ResponseEntity<byte[]> exportXlsx(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        BundleExportService.Export export = exports.exportXlsx(auth, id);
        return Downloads.attachment(export.fileName(), XLSX, export.content());
    }

    /** Checks and audit run first (errors are JSON); then the ZIP is streamed file by file. */
    @GetMapping("/api/requests/{id}/bundle/attachments.zip")
    public void exportZip(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            HttpServletResponse response) throws IOException {
        BundleExportService.ZipPlan plan = exports.prepareZip(auth, id);
        response.setStatus(HttpStatus.OK.value());
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, Downloads.contentDisposition("attachment",
                plan.fileName()));
        response.setHeader("X-Content-Type-Options", "nosniff");
        exports.writeZip(plan, response.getOutputStream());
        response.flushBuffer();
    }

    @PostMapping("/api/requests/{id}/bundle/copy-events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void copyEvent(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody(required = false) CopyEventBody body) {
        exports.recordCopy(auth, id, body == null ? null : body.contentKey());
    }
}
