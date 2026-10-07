package com.txtms.domain.variable.dto;

import com.txtms.domain.variable.entity.VariableType;

/** Variable value frozen in a completion bundle ({@code {key, type, value}}). */
public record VariableSnapshot(String key, VariableType type, String value) {
}
