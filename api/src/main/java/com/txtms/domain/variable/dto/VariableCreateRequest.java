package com.txtms.domain.variable.dto;

import com.txtms.domain.variable.entity.VariableType;

public record VariableCreateRequest(String key, String description, VariableType type, String value) {
}
