package com.txtms.domain.ops.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.contenttype.dto.ContentTypeResponse;
import com.txtms.domain.mail.OutboxService.OutboxMail;
import com.txtms.domain.ops.dto.OpsDtos.ContentTypeActiveBody;
import com.txtms.domain.ops.dto.OpsDtos.CreateCustomerBody;
import com.txtms.domain.ops.dto.OpsDtos.DeactivateCustomerBody;
import com.txtms.domain.ops.dto.OpsDtos.OpsCustomer;
import com.txtms.domain.ops.dto.OpsDtos.OpsDashboard;
import com.txtms.domain.ops.dto.OpsDtos.OpsInvitation;
import com.txtms.domain.ops.dto.OpsDtos.SampleOverview;
import com.txtms.domain.ops.dto.OpsDtos.SampleRequestBody;
import com.txtms.domain.ops.dto.OpsDtos.SampleResetResult;
import com.txtms.domain.ops.dto.OpsDtos.SetupLogEntry;
import com.txtms.domain.ops.dto.OpsDtos.SetupProjectBody;
import com.txtms.domain.ops.dto.OpsDtos.TemplateBody;
import com.txtms.domain.ops.service.OpsCustomerService;
import com.txtms.domain.ops.service.OpsLogService;
import com.txtms.domain.ops.service.OpsSampleService;
import com.txtms.domain.ops.service.OpsSetupService;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.request.dto.response.SampleRequestSummary;
import com.txtms.domain.user.dto.MemberBodies.SetupInvitationBody;
import com.txtms.domain.user.dto.MemberResponse;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

/** Solution operator API (contract §9 {@code /api/ops/dashboard}, §12). Operators only ({@code OpsAccessInterceptor}). */
@RestController
@RequestMapping("/api/ops")
public class OpsController {

    private final OpsCustomerService customers;
    private final OpsSetupService setup;
    private final OpsSampleService samples;
    private final OpsLogService logs;

    public OpsController(OpsCustomerService customers, OpsSetupService setup, OpsSampleService samples,
            OpsLogService logs) {
        this.customers = customers;
        this.setup = setup;
        this.samples = samples;
        this.logs = logs;
    }

    @GetMapping("/dashboard")
    public OpsDashboard dashboard(@AuthenticationPrincipal AuthUser auth) {
        return customers.dashboard(auth);
    }

    // ------------------------------------------------------------------ customers

    @GetMapping("/customers")
    public List<OpsCustomer> customers(@AuthenticationPrincipal AuthUser auth) {
        return customers.list(auth);
    }

    @PostMapping("/customers")
    @ResponseStatus(HttpStatus.CREATED)
    public OpsCustomer create(@AuthenticationPrincipal AuthUser auth,
            @RequestBody(required = false) CreateCustomerBody body) {
        return customers.create(auth, body);
    }

    @PostMapping("/customers/{id}/deactivate")
    public OpsCustomer deactivate(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) DeactivateCustomerBody body) {
        return customers.deactivate(auth, id, body == null ? null : body.reason());
    }

    @PostMapping("/customers/{id}/reactivate")
    public OpsCustomer reactivate(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return customers.reactivate(auth, id);
    }

    // ------------------------------------------------------------------ initial setup

    @PostMapping("/customers/{id}/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse createProject(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) SetupProjectBody body) {
        return setup.createProject(auth, id, body);
    }

    @PostMapping("/customers/{id}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public OpsInvitation invite(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) SetupInvitationBody body) {
        return setup.invite(auth, id, body);
    }

    @GetMapping("/customers/{id}/members")
    public List<MemberResponse> members(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return setup.members(auth, id);
    }

    @GetMapping("/customers/{id}/projects")
    public List<ProjectResponse> projects(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return setup.projects(auth, id);
    }

    @PutMapping("/projects/{id}/templates")
    public ProjectResponse templates(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) List<TemplateBody> body) {
        return setup.replaceTemplates(auth, id, body);
    }

    @PutMapping("/projects/{id}/senders")
    public ProjectResponse senders(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) List<String> body) {
        return setup.replaceSenders(auth, id, body);
    }

    @GetMapping("/setup-logs")
    public List<SetupLogEntry> setupLogs(@AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long customerId) {
        return logs.setupLogs(auth, customerId);
    }

    // ------------------------------------------------------------------ content types

    @GetMapping("/content-types")
    public List<ContentTypeResponse> contentTypes(@AuthenticationPrincipal AuthUser auth) {
        return setup.contentTypes(auth);
    }

    @PatchMapping("/content-types/{type}")
    public ContentTypeResponse contentType(@AuthenticationPrincipal AuthUser auth, @PathVariable String type,
            @RequestBody(required = false) ContentTypeActiveBody body) {
        return setup.setContentTypeActive(auth, type, body == null ? null : body.active());
    }

    // ------------------------------------------------------------------ sample data

    @GetMapping("/customers/{id}/sample-requests")
    public SampleOverview sampleRequests(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return samples.overview(auth, id);
    }

    @PostMapping("/customers/{id}/sample-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public SampleRequestSummary createSample(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody(required = false) SampleRequestBody body) {
        return samples.create(auth, id, body);
    }

    @DeleteMapping("/customers/{id}/sample-data")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearSamples(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        samples.clear(auth, id);
    }

    @PostMapping("/sample-reset")
    public SampleResetResult reset(@AuthenticationPrincipal AuthUser auth) {
        return samples.reset(auth);
    }

    // ------------------------------------------------------------------ logs

    @GetMapping("/audit-logs")
    public PageResponse<AuditLogService.Entry> auditLogs(@AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long customerId, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return logs.auditLogs(auth, customerId, PageQuery.of(page, size));
    }

    @GetMapping("/outbox")
    public PageResponse<OutboxMail> outbox(@AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long customerId, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return logs.outbox(auth, customerId, PageQuery.of(page, size));
    }
}
