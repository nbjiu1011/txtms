package com.txtms.domain.correction.dto;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.correction.entity.DatasetScope;

/** Contract §12 correction datasets and assignments. */
public final class DatasetDtos {

    private DatasetDtos() {
    }

    /** Dataset version: {@code { id, scope, version, ruleCount, createdAt, createdBy }}. */
    public record DatasetResponse(long id, DatasetScope scope, int version, int ruleCount, Instant createdAt,
            Long createdBy) {
    }

    /** Dataset + its rules in dataset order. */
    public record DatasetDetailResponse(@JsonUnwrapped DatasetResponse dataset, List<RuleDto> rules) {
    }

    /** One rule in the seven engine columns (request and response). */
    public record RuleDto(String ruleId, String originalExpr, String recommendedExpr, String originalPattern,
            String recommendedPattern, String descriptionLabel, String description) {

        public static RuleDto of(CorrectionRule r) {
            return new RuleDto(r.ruleId(), r.originalExpr(), r.recommendedExpr(), r.originalPattern(),
                    r.recommendedPattern(), r.descriptionLabel(), r.description());
        }
    }

    /** JSON registration: {@code { scope, rules }}. */
    public record CreateDatasetBody(String scope, List<RuleDto> rules) {
    }

    /** {@code { customerId, type, datasetId, assignedAt, assignedBy, checkedAt, checkedBy }}. */
    public record AssignmentResponse(long customerId, DatasetScope type, long datasetId, Instant assignedAt,
            Long assignedBy, Instant checkedAt, Long checkedBy) {
    }

    public record AssignBody(Long datasetId) {
    }
}
