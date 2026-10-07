package com.txtms.domain.request.dto.request;

import com.txtms.domain.contenttype.entity.ContentType;

public record ChangeTypeBody(ContentType type, Long rowVersion) {
}
