package com.txtms.domain.variable.dto;

import com.txtms.domain.variable.entity.VariableType;

/** Partial update: null keeps the current value. */
public record VariableUpdateRequest(String key, String description, VariableType type, String value, Boolean active) {
}
