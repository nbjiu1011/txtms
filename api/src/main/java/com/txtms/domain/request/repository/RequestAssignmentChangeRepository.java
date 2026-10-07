package com.txtms.domain.request.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.RequestAssignmentChange;

public interface RequestAssignmentChangeRepository extends JpaRepository<RequestAssignmentChange, Long> {

    List<RequestAssignmentChange> findByRequestIdOrderByAtAscIdAsc(String requestId);
}
