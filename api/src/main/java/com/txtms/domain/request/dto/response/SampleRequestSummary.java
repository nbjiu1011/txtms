package com.txtms.domain.request.dto.response;

import java.time.Instant;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.entity.RequestStatus;

/**
 * Sample request as the operator sees it (contract §12, a subset of RequestSummary with the same keys). Only sample
 * ({@code demo}) requests are ever listed to the operator.
 */
public record SampleRequestSummary(String id, long projectId, ContentType type, String title, RequestStatus status,
        Instant createdAt) {
}
