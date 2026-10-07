package com.txtms.domain.request.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.request.dto.request.CorrectionBodies.CheckBody;
import com.txtms.domain.request.dto.request.CorrectionBodies.EventBody;
import com.txtms.domain.request.dto.request.CorrectionBodies.SuggestionBody;
import com.txtms.domain.request.dto.response.CorrectionResponses.CheckResponse;
import com.txtms.domain.request.dto.response.CorrectionResponses.DatasetInfo;
import com.txtms.domain.request.service.RequestCorrectionService;
import com.txtms.global.security.AuthUser;

/** Text correction of a request (contract §6). */
@RestController
public class CorrectionController {

    private final RequestCorrectionService corrections;

    public CorrectionController(RequestCorrectionService corrections) {
        this.corrections = corrections;
    }

    @PostMapping("/api/requests/{id}/corrections/check")
    public CheckResponse check(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody CheckBody body) {
        return corrections.check(auth, id, body);
    }

    @GetMapping("/api/requests/{id}/corrections/dataset")
    public DatasetInfo dataset(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        return corrections.dataset(auth, id);
    }

    @PostMapping("/api/requests/{id}/corrections/events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void event(@AuthenticationPrincipal AuthUser auth, @PathVariable String id, @RequestBody EventBody body) {
        corrections.event(auth, id, body);
    }

    @PostMapping("/api/requests/{id}/corrections/suggestions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void suggest(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @RequestBody SuggestionBody body) {
        corrections.suggest(auth, id, body);
    }
}
