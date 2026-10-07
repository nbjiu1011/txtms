package com.txtms.domain.customer.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.customer.dto.CustomerResponse;
import com.txtms.domain.customer.dto.CustomerSettingsBody;
import com.txtms.domain.customer.service.CustomerSettingsService;
import com.txtms.domain.mail.OutboxService.OutboxMail;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

/** Customer settings, outbox and audit log of the customer admin (contract §11). */
@RestController
@RequestMapping("/api/customers/{customerId}")
public class CustomerAdminController {

    private final CustomerSettingsService settings;

    public CustomerAdminController(CustomerSettingsService settings) {
        this.settings = settings;
    }

    @PatchMapping("/settings")
    public CustomerResponse updateSettings(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestBody(required = false) CustomerSettingsBody body) {
        return settings.updateSettings(auth, customerId, body);
    }

    @GetMapping("/outbox")
    public PageResponse<OutboxMail> outbox(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return settings.outbox(auth, customerId, PageQuery.of(page, size));
    }

    @GetMapping("/audit-logs")
    public PageResponse<AuditLogService.Entry> auditLogs(@AuthenticationPrincipal AuthUser auth,
            @PathVariable long customerId, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return settings.auditLogs(auth, customerId, PageQuery.of(page, size));
    }
}
