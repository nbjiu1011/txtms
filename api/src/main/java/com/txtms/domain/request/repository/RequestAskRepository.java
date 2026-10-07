package com.txtms.domain.request.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.RequestAsk;

public interface RequestAskRepository extends JpaRepository<RequestAsk, Long> {

    List<RequestAsk> findByRequestIdOrderByAskedAtAscIdAsc(String requestId);
}
