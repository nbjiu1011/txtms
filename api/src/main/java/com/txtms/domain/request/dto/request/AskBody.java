package com.txtms.domain.request.dto.request;

/** Question to the requester about a content ({@code contentKey}) or the whole request (null). */
public record AskBody(String contentKey, String question, Long rowVersion) {
}
