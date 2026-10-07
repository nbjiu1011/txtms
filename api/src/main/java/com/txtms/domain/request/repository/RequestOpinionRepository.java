package com.txtms.domain.request.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.RequestOpinion;

public interface RequestOpinionRepository extends JpaRepository<RequestOpinion, Long> {

    List<RequestOpinion> findByRequestIdOrderByCreatedAtAscIdAsc(String requestId);
}
