package com.txtms.global.exception;

import org.springframework.http.HttpStatus;

/** Machine-readable error codes of the API contract with their HTTP status and default message. */
public enum ErrorCode {
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다"),
    SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "세션이 만료되었습니다. 다시 로그인하세요"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "이 작업을 실행할 권한이 없습니다"),
    /** Someone else's draft request (same customer). The message names the request id. */
    DRAFT_PRIVATE(HttpStatus.FORBIDDEN, "작성 중 요청은 작성한 요청자만 조회할 수 있습니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "대상을 찾을 수 없습니다"),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "입력값을 확인하세요"),
    REQUEST_STATE_CONFLICT(HttpStatus.CONFLICT, "현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다"),
    VERSION_CONFLICT(HttpStatus.CONFLICT, "다른 사용자가 먼저 저장했습니다"),
    LOCKED_BY_OTHER(HttpStatus.CONFLICT, "다른 사용자가 편집 중입니다"),
    DUPLICATE(HttpStatus.CONFLICT, "이미 등록되어 있습니다"),
    /** Invitation or email change to a domain other than the customer's, sent without the confirmation flag. */
    EXTERNAL_DOMAIN_CONFIRM_REQUIRED(HttpStatus.CONFLICT,
            "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 다시 요청하면 진행됩니다"),
    LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "허용 한도를 넘었습니다"),
    NO_ELIGIBLE_APPROVER(HttpStatus.CONFLICT, "적격 승인자가 없습니다. 관리자에게 승인자 지정을 요청했습니다"),
    DATASET_NOT_ASSIGNED(HttpStatus.CONFLICT, "유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요"),
    FILE_REJECTED(HttpStatus.BAD_REQUEST, "파일을 등록할 수 없습니다"),
    /** Malware scan found a threat (same 400 as FILE_REJECTED; the message is the scan wording). */
    FILE_UNSAFE(HttpStatus.BAD_REQUEST, "위험 파일 검사 결과: 등록할 수 없습니다"),
    /** The malware scan service failed (same 400 as FILE_REJECTED; the message is the scan wording). */
    FILE_SCAN_FAILED(HttpStatus.BAD_REQUEST, "검사 서비스 실패: 등록할 수 없습니다"),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "로그인 시도가 많아 잠시 잠겼습니다. 15분 후 다시 시도하세요"),
    INTERNAL(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
