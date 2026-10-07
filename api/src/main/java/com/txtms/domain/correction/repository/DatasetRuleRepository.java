package com.txtms.domain.correction.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.txtms.domain.correction.entity.DatasetRule;

public interface DatasetRuleRepository extends JpaRepository<DatasetRule, Long> {

    List<DatasetRule> findByDatasetIdOrderBySortOrderAsc(Long datasetId);

    /** Rows of {@code [datasetId, ruleCount]} for every dataset that has rules. */
    @Query("select r.datasetId, count(r) from DatasetRule r group by r.datasetId")
    List<Object[]> countByDataset();
}
