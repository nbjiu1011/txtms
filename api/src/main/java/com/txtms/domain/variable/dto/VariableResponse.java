package com.txtms.domain.variable.dto;

import java.time.Instant;

import com.txtms.domain.variable.entity.VariableType;

/** Contract Variable (§7). {@code deleted} is true only for logically deleted variables (admin listing). */
public record VariableResponse(
        long id,
        long projectId,
        String key,
        String description,
        VariableType type,
        String value,
        boolean active,
        boolean inUse,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt,
        boolean deleted) {
}
