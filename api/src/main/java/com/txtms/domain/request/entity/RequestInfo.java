package com.txtms.domain.request.entity;

import java.time.LocalDate;

/** Editable request information of a draft. */
public record RequestInfo(
        String title,
        LocalDate hopeDueDate,
        String purpose,
        String target,
        String background,
        String campaign,
        Urgency urgency) {
}
