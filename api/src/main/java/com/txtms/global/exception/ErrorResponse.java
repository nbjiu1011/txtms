package com.txtms.global.exception;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Error body: {@code { code, message, fieldErrors?, details? }}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, List<FieldErrorItem> fieldErrors, List<String> details) {

    public record FieldErrorItem(String field, String message) {
    }
}
