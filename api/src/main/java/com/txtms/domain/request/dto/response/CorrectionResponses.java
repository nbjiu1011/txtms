package com.txtms.domain.request.dto.response;

import java.time.Instant;
import java.util.List;

import com.txtms.global.exception.ErrorResponse;

/** Responses of the text correction endpoints (contract §6) and the submit pre-check (§5). */
public final class CorrectionResponses {

    private CorrectionResponses() {
    }

    /** {@code { results: [CorrectionResult] }} in the order of the request body. */
    public record CheckResponse(List<CorrectionResult> results) {
    }

    /**
     * Contract §6.1. {@code variablesRevision} is the project's revision at check time (freshness).
     */
    public record CorrectionResult(String contentKey, Instant checkedAt, String datasetLabel, int variablesRevision,
            List<Group> groups) {
    }

    /** Same-span findings (1:N). {@code id} = {@code field:start:end}; indices are UTF-16 code units. */
    public record Group(String id, String field, int start, int end, String matchedText, List<Option> options) {
    }

    /** {@code recommended} is null for description-only rules (shown without an apply button). */
    public record Option(String ruleId, String recommended, String descriptionLabel, String description) {
    }

    /** {@code GET /api/requests/{id}/corrections/dataset}: the panel header before a check. */
    public record DatasetInfo(boolean assigned, String datasetLabel) {
    }

    /**
     * {@code POST /api/requests/{id}/submit-check}: the submit validation without a state change. {@code warnings}
     * are channel specification notes and do not affect {@code ok}.
     */
    public record SubmitCheck(boolean ok, List<String> details, List<ErrorResponse.FieldErrorItem> fieldErrors,
            List<String> warnings) {
    }
}
