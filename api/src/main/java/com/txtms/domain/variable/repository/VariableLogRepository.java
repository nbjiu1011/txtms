package com.txtms.domain.variable.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.variable.entity.VariableLog;

public interface VariableLogRepository extends JpaRepository<VariableLog, Long> {

    List<VariableLog> findByVariableIdOrderByAtAscIdAsc(Long variableId);

    /** Change log of every variable of the project (deleted ones included), newest first. */
    @Query("select l from VariableLog l where l.variableId in "
            + "(select v.id from Variable v where v.projectId = :projectId) order by l.at desc, l.id desc")
    List<VariableLog> findByProjectNewestFirst(@Param("projectId") Long projectId, Pageable pageable);
}
