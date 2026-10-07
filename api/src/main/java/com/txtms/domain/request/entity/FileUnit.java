package com.txtms.domain.request.entity;

import java.util.Map;
import java.util.Optional;

/** Volume unit of an attachment, derived from its extension. */
public enum FileUnit {
    PAGE,
    ROW,
    SLIDE,
    LINE,
    IMAGE;

    private static final Map<String, FileUnit> BY_EXTENSION = Map.of(
            "pdf", PAGE, "docx", PAGE, "hwp", PAGE,
            "xlsx", ROW,
            "pptx", SLIDE,
            "txt", LINE,
            "png", IMAGE, "jpg", IMAGE);

    public static Optional<FileUnit> ofExtension(String ext) {
        return Optional.ofNullable(ext == null ? null : BY_EXTENSION.get(ext.toLowerCase()));
    }
}
