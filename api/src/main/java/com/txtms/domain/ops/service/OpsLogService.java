package com.txtms.domain.ops.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.mail.OutboxMasking;
import com.txtms.domain.mail.OutboxService;
import com.txtms.domain.mail.OutboxService.OutboxMail;
import com.txtms.domain.ops.dto.OpsDtos.SetupLogEntry;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.config.AppProperties;
import com.txtms.global.security.AuthUser;

/** Operator listings: audit log of every customer, setup log, outbox (token links masked outside demo mode). */
@Service
@Transactional(readOnly = true)
public class OpsLogService {

    private final OperatorAccess operators;
    private final CustomerService customers;
    private final AuditLogService audit;
    private final SetupLogService setupLogs;
    private final OutboxService outbox;
    private final AppProperties properties;

    public OpsLogService(OperatorAccess operators, CustomerService customers, AuditLogService audit,
            SetupLogService setupLogs, OutboxService outbox, AppProperties properties) {
        this.operators = operators;
        this.customers = customers;
        this.audit = audit;
        this.setupLogs = setupLogs;
        this.outbox = outbox;
        this.properties = properties;
    }

    /** One customer's records, or every record (customer and global operator actions) when absent. */
    public PageResponse<AuditLogService.Entry> auditLogs(AuthUser auth, Long customerId, PageQuery page) {
        operators.require(auth);
        if (customerId == null) {
            return audit.all(page);
        }
        return audit.ofCustomer(customers.require(customerId).getId(), page);
    }

    public List<SetupLogEntry> setupLogs(AuthUser auth, Long customerId) {
        operators.require(auth);
        if (customerId != null) {
            customers.require(customerId);
        }
        return setupLogs.list(customerId);
    }

    /**
     * Every queued mail, or the mails addressed to one customer's users (inactive customers included; missing
     * customer {@code NOT_FOUND}), newest first.
     */
    public PageResponse<OutboxMail> outbox(AuthUser auth, Long customerId, PageQuery page) {
        operators.require(auth);
        boolean reveal = OutboxMasking.revealForOperator(properties.demo().enabled());
        if (customerId == null) {
            return outbox.all(page, reveal);
        }
        return outbox.ofCustomer(customers.require(customerId).getId(), page, reveal);
    }
}
