package com.txtms.domain.correction.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.correction.entity.CorrectionSuggestion;

public interface CorrectionSuggestionRepository extends JpaRepository<CorrectionSuggestion, Long> {

    List<CorrectionSuggestion> findByRequestIdOrderByIdAsc(String requestId);
}
