package com.txtms.domain.variable.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.variable.entity.Variable;

public interface VariableRepository extends JpaRepository<Variable, Long> {

    List<Variable> findByProjectIdAndDeletedFalseOrderByIdAsc(Long projectId);

    /** Every variable of the project, deleted ones included, in registration order. */
    List<Variable> findByProjectIdOrderByIdAsc(Long projectId);

    List<Variable> findByProjectIdAndActiveTrueAndDeletedFalseOrderByIdAsc(Long projectId);

    /** Case-insensitive key match within the project, deleted variables included. */
    @Query("select v from Variable v where v.projectId = :projectId and lower(v.key) = lower(:key)")
    List<Variable> findByProjectIdAndKeyIgnoreCase(@Param("projectId") Long projectId, @Param("key") String key);
}
