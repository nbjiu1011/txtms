package com.txtms.domain.request.dto.response;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonRawValue;

/**
 * XLSX preview: every non-empty data row with the payload it maps to, its errors (empty = can be added) and its
 * channel specification warnings (never block adding the row).
 */
public record BulkPreviewResponse(List<Row> rows, int limit) {

    public record Row(int rowNumber, String title, @JsonRawValue String payload, List<String> errors,
            List<String> warnings) {
    }
}
