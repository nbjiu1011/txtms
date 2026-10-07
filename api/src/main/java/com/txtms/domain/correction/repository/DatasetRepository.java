package com.txtms.domain.correction.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.correction.entity.Dataset;
import com.txtms.domain.correction.entity.DatasetScope;

public interface DatasetRepository extends JpaRepository<Dataset, Long> {

    @Query("select coalesce(max(d.version), 0) from Dataset d where d.scope = :scope")
    int maxVersion(@Param("scope") DatasetScope scope);

    Optional<Dataset> findFirstByScopeOrderByVersionDesc(DatasetScope scope);
}
