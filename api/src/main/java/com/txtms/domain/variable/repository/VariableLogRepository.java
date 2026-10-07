package com.txtms.domain.variable.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.variable.entity.VariableLog;

public interface VariableLogRepository extends JpaRepository<VariableLog, Long> {

    List<VariableLog> findByVariableIdOrderByAtAscIdAsc(Long variableId);
}
