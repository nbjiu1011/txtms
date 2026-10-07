package com.txtms.domain.correction.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.correction.entity.CorrectionSuggestion;
import com.txtms.domain.correction.repository.CorrectionSuggestionRepository;

import tools.jackson.databind.json.JsonMapper;

/**
 * Stores "건의하기" suggestions on correction results. Phase 1 only collects them; reviewing and turning them into
 * dataset changes is Phase 2 (no screen, no notification).
 */
@Service
public class CorrectionSuggestionService {

    private final CorrectionSuggestionRepository repository;
    private final JsonMapper json;

    public CorrectionSuggestionService(CorrectionSuggestionRepository repository, JsonMapper json) {
        this.repository = repository;
        this.json = json;
    }

    /** Runs inside the caller's request transaction (validated input). */
    @Transactional(propagation = Propagation.MANDATORY)
    public CorrectionSuggestion record(String requestId, String contentKey, String matchedText, List<String> ruleIds,
            String body, long userId, Instant now) {
        return repository.save(new CorrectionSuggestion(requestId, contentKey, matchedText,
                json.writeValueAsString(ruleIds), body, userId, now));
    }
}
