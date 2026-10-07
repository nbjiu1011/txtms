package com.txtms.domain.request.dto.request;

/** Reviewer opinion on a content ({@code contentKey}) or the whole request (null). */
public record OpinionBody(String contentKey, String body, Long rowVersion) {
}
