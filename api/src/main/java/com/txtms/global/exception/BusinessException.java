package com.txtms.global.exception;

import java.util.List;

/** The single exception type for expected failures. Rendered by {@link GlobalExceptionHandler}. */
public class BusinessException extends RuntimeException {

    private final ErrorCode code;
    private final transient List<ErrorResponse.FieldErrorItem> fieldErrors;
    private final transient List<String> details;

    public BusinessException(ErrorCode code) {
        this(code, code.defaultMessage());
    }

    public BusinessException(ErrorCode code, String message) {
        this(code, message, null, null);
    }

    public BusinessException(ErrorCode code, String message, List<ErrorResponse.FieldErrorItem> fieldErrors,
            List<String> details) {
        super(message);
        this.code = code;
        this.fieldErrors = fieldErrors;
        this.details = details;
    }

    public static BusinessException notFound() {
        return new BusinessException(ErrorCode.NOT_FOUND);
    }

    public static BusinessException forbidden() {
        return new BusinessException(ErrorCode.FORBIDDEN);
    }

    public static BusinessException validation(String field, String message) {
        return new BusinessException(ErrorCode.VALIDATION_FAILED, message,
                List.of(new ErrorResponse.FieldErrorItem(field, message)), null);
    }

    public ErrorCode getCode() {
        return code;
    }

    public List<ErrorResponse.FieldErrorItem> getFieldErrors() {
        return fieldErrors;
    }

    public List<String> getDetails() {
        return details;
    }
}
