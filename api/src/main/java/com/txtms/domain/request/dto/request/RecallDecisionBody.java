package com.txtms.domain.request.dto.request;

/** Primary reviewer's decision on a pending recall ({@code comment} required). */
public record RecallDecisionBody(Boolean approve, String comment, Long rowVersion) {
}
