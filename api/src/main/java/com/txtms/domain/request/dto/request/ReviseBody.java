package com.txtms.domain.request.dto.request;

/** Approver's revision request: reason, target content, optional detailed location and the expected result. */
public record ReviseBody(String reason, String contentKey, String location, String expectation, Long rowVersion) {
}
