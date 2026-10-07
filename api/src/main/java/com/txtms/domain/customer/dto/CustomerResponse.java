package com.txtms.domain.customer.dto;

import java.time.Instant;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;

/** Contract Customer (§2.1). */
public record CustomerResponse(
        long id,
        String name,
        String domain,
        boolean approvalEnabled,
        boolean active,
        boolean sample,
        NotifyChannel notifyChannel,
        int dueSoonDays,
        Instant createdAt) {

    public static CustomerResponse of(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getDomain(), c.isApprovalEnabled(), c.isActive(),
                c.isSample(), c.getNotifyChannel(), c.getDueSoonDays(), c.getCreatedAt());
    }
}
