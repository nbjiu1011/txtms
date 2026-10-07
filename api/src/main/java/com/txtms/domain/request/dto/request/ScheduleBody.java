package com.txtms.domain.request.dto.request;

import java.time.LocalDate;

import com.txtms.domain.request.entity.Urgency;

/** Confirmed due date and urgency change with its reason ({@code urgency} null keeps the current value). */
public record ScheduleBody(LocalDate dueDate, Urgency urgency, String reason, Long rowVersion) {
}
