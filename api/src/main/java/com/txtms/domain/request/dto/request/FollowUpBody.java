package com.txtms.domain.request.dto.request;

/** Follow-up request from a completed request: one bundle content, or the whole bundle when null. */
public record FollowUpBody(String contentKey) {
}
