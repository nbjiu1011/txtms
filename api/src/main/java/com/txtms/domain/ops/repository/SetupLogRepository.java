package com.txtms.domain.ops.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.ops.entity.SetupLog;

public interface SetupLogRepository extends JpaRepository<SetupLog, Long> {

    Page<SetupLog> findByCustomerIdOrderByAtDescIdDesc(Long customerId, Pageable pageable);

    Page<SetupLog> findAllByOrderByAtDescIdDesc(Pageable pageable);
}
