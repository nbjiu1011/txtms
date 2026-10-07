package com.txtms.domain.correction.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.txtms.domain.correction.engine.CorrectionRule;

/** A rule row of a dataset version in the seven engine columns (immutable). */
@Entity
@Table(name = "dataset_rules")
public class DatasetRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dataset_id", nullable = false, updatable = false)
    private Long datasetId;

    @Column(name = "sort_order", nullable = false, updatable = false)
    private int sortOrder;

    @Column(name = "rule_id", nullable = false, updatable = false, length = 50)
    private String ruleId;

    @Column(name = "original_expr", updatable = false, length = 500)
    private String originalExpr;

    @Column(name = "recommended_expr", updatable = false, length = 500)
    private String recommendedExpr;

    @Column(name = "original_pattern", updatable = false, length = 500)
    private String originalPattern;

    @Column(name = "recommended_pattern", updatable = false, length = 500)
    private String recommendedPattern;

    @Column(name = "description_label", updatable = false, length = 100)
    private String descriptionLabel;

    @Column(updatable = false, columnDefinition = "text")
    private String description;

    protected DatasetRule() {
    }

    public DatasetRule(Long datasetId, int sortOrder, CorrectionRule rule) {
        this.datasetId = datasetId;
        this.sortOrder = sortOrder;
        this.ruleId = rule.ruleId();
        this.originalExpr = rule.originalExpr();
        this.recommendedExpr = rule.recommendedExpr();
        this.originalPattern = rule.originalPattern();
        this.recommendedPattern = rule.recommendedPattern();
        this.descriptionLabel = rule.descriptionLabel();
        this.description = rule.description();
    }

    public CorrectionRule toRule() {
        return new CorrectionRule(ruleId, originalExpr, recommendedExpr, originalPattern, recommendedPattern,
                descriptionLabel, description);
    }

    public Long getId() {
        return id;
    }

    public Long getDatasetId() {
        return datasetId;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
