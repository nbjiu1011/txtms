package com.txtms.domain.correction.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.correction.entity.DatasetAssignment;
import com.txtms.domain.correction.entity.DatasetScope;

public interface DatasetAssignmentRepository extends JpaRepository<DatasetAssignment, Long> {

    Optional<DatasetAssignment> findByCustomerIdAndType(Long customerId, DatasetScope type);

    List<DatasetAssignment> findAllByOrderByCustomerIdAscIdAsc();

    List<DatasetAssignment> findByCustomerId(Long customerId);
}
