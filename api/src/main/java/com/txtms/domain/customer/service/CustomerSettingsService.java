package com.txtms.domain.customer.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.dto.CustomerResponse;
import com.txtms.domain.customer.dto.CustomerSettingsBody;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.customer.service.CustomerAdminAccess.Admin;
import com.txtms.domain.mail.OutboxService;
import com.txtms.domain.mail.OutboxService.OutboxMail;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

/**
 * Customer settings, outbox and audit log of the customer admin (contract §11). Domain and approval are read-only;
 * a settings change is audited as {@code 고객사 설정 변경} with the before and after values.
 */
@Service
@Transactional
public class CustomerSettingsService {

    static final int NAME_MAX = 100;
    static final int DUE_SOON_MIN = 1;
    static final int DUE_SOON_MAX = 14;

    private final CustomerAdminAccess adminAccess;
    private final CustomerService customers;
    private final OutboxService outbox;
    private final AuditLogService audit;
    private final Clock clock;

    public CustomerSettingsService(CustomerAdminAccess adminAccess, CustomerService customers, OutboxService outbox,
            AuditLogService audit, Clock clock) {
        this.adminAccess = adminAccess;
        this.customers = customers;
        this.outbox = outbox;
        this.audit = audit;
        this.clock = clock;
    }

    public CustomerResponse updateSettings(AuthUser auth, long customerId, CustomerSettingsBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        Customer customer = customers.require(admin.customerId());
        CustomerSettingsBody b = body == null ? new CustomerSettingsBody(null, null, null) : body;
        String name = customer.getName();
        if (b.name() != null) {
            name = b.name().trim();
            if (name.isEmpty()) {
                throw BusinessException.validation("name", "고객사 이름을(를) 입력하세요");
            }
            if (name.length() > NAME_MAX) {
                throw BusinessException.validation("name", "고객사 이름은 최대 100자입니다");
            }
        }
        NotifyChannel channel = b.notifyChannel() != null ? b.notifyChannel() : customer.getNotifyChannel();
        int dueSoonDays = customer.getDueSoonDays();
        if (b.dueSoonDays() != null) {
            dueSoonDays = b.dueSoonDays();
            if (dueSoonDays < DUE_SOON_MIN || dueSoonDays > DUE_SOON_MAX) {
                throw BusinessException.validation("dueSoonDays", "납기 임박 기준은 1~14일입니다");
            }
        }
        List<String> changes = new ArrayList<>();
        if (!name.equals(customer.getName())) {
            changes.add("이름 " + customer.getName() + " → " + name);
        }
        if (channel != customer.getNotifyChannel()) {
            changes.add("업무 알림 채널 " + label(customer.getNotifyChannel()) + " → " + label(channel));
        }
        if (dueSoonDays != customer.getDueSoonDays()) {
            changes.add("납기 임박 기준 " + customer.getDueSoonDays() + "일 → " + dueSoonDays + "일");
        }
        if (!changes.isEmpty()) {
            customer.updateSettings(name, channel, dueSoonDays, clock.instant());
            audit.record(admin.userId(), admin.customerId(), "고객사 설정 변경", name, String.join(" / ", changes));
        }
        return CustomerResponse.of(customer);
    }

    @Transactional(readOnly = true)
    public PageResponse<OutboxMail> outbox(AuthUser auth, long customerId, PageQuery page) {
        Admin admin = adminAccess.require(auth, customerId);
        return outbox.ofCustomer(admin.customerId(), page);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogService.Entry> auditLogs(AuthUser auth, long customerId, PageQuery page) {
        Admin admin = adminAccess.require(auth, customerId);
        return audit.ofCustomer(admin.customerId(), page);
    }

    static String label(NotifyChannel channel) {
        return channel == NotifyChannel.IN_APP_EMAIL ? "제품 내 알림 + 이메일" : "제품 내 알림";
    }
}
