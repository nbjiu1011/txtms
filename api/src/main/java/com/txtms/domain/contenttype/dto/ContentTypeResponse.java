package com.txtms.domain.contenttype.dto;

import com.txtms.domain.contenttype.entity.ContentType;

public record ContentTypeResponse(ContentType type, boolean active, boolean mockEnabled) {
}
