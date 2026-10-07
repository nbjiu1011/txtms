package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

import com.txtms.domain.request.entity.FileScanStatus;
import com.txtms.domain.request.entity.FileUnit;

/** Contract FileMeta (§3.5). */
public record FileMeta(
        long id,
        String name,
        String ext,
        FileUnit unit,
        long sizeBytes,
        Integer totalAmount,
        Integer reviewAmount,
        String rangeNote,
        int version,
        FileScanStatus scanStatus,
        List<FileVersion> versions) {

    public record FileVersion(int version, String name, Instant createdAt, long createdBy, long sizeBytes) {
    }
}
