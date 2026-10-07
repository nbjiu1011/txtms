package com.txtms.domain.ops.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.ops.entity.SetupLog;

public interface SetupLogRepository extends JpaRepository<SetupLog, Long> {

    List<SetupLog> findByCustomerIdOrderByAtDescIdDesc(Long customerId, Pageable pageable);

    List<SetupLog> findAllByOrderByAtDescIdDesc(Pageable pageable);
}
