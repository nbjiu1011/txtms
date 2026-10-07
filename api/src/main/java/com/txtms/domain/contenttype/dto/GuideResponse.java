package com.txtms.domain.contenttype.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;
import com.txtms.domain.contenttype.entity.ContentType;

/** Read-only writing guide. {@code goodExpressions} is {@code [{avoid, prefer}]}, checklist a string array. */
public record GuideResponse(
        ContentType type,
        String principles,
        @JsonRawValue String goodExpressions,
        @JsonRawValue String checklist) {
}
