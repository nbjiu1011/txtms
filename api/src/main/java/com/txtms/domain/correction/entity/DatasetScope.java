package com.txtms.domain.correction.entity;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;

/**
 * Scope of a correction dataset: one content type, or {@code COMMON}. Phase 1 runs one dataset per customer × content
 * type (actions.md §6.2, §10 #5); {@code COMMON} is kept for the Phase 2 combination and is neither registered nor
 * assigned now.
 */
public enum DatasetScope {
    COMMON,
    ALIMTALK,
    SMS,
    RCS,
    FREEFORM;

    public static DatasetScope of(ContentType type) {
        return valueOf(type.name());
    }

    /** The content type of a type scope, null for {@code COMMON}. */
    public ContentType contentType() {
        return this == COMMON ? null : ContentType.valueOf(name());
    }

    public String label() {
        return this == COMMON ? "공통" : ContentTypeService.label(contentType());
    }

    /** Screen label of a dataset version, e.g. {@code 알림톡 v3}. */
    public String label(int version) {
        return label() + " v" + version;
    }
}
