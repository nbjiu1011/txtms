package com.txtms.domain.request.dto.request;

import com.txtms.domain.contenttype.entity.ContentType;

/** {@code type} may be omitted: the first active type is used. */
public record CreateRequestBody(Long projectId, ContentType type) {
}
