package com.txtms.domain.customer.dto;

import com.txtms.domain.customer.entity.NotifyChannel;

/** Customer settings edit (customer admin). Omitted (null) keys keep the current value. */
public record CustomerSettingsBody(String name, NotifyChannel notifyChannel, Integer dueSoonDays) {
}
