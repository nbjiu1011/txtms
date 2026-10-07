package com.txtms.domain.variable.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonRawValue;

/**
 * One entry of a project's variable change log: VariableLog plus the variable it belongs to and the actor's name
 * ({@code null} when the actor is unknown). before/after are {@code {key, type, value, active}} snapshots.
 */
public record ProjectVariableLogResponse(
        long variableId,
        Instant at,
        Long actorId,
        String actorName,
        String action,
        @JsonRawValue String before,
        @JsonRawValue String after) {
}
