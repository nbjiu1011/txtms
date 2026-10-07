package com.txtms.domain.variable.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonRawValue;

/** Contract VariableLog (§7): before/after are {@code {key, type, value, active}} snapshots. */
public record VariableLogResponse(
        Instant at,
        Long actorId,
        String action,
        @JsonRawValue String before,
        @JsonRawValue String after) {
}
