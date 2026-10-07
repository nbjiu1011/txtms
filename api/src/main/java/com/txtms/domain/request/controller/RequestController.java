package com.txtms.domain.request.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.response.ContentVersionResponse;
import com.txtms.domain.request.dto.response.HistoryEntryResponse;
import com.txtms.domain.request.dto.response.RequestDetail;
import com.txtms.domain.request.dto.response.RequestSummary;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.RequestView;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/requests")
public class RequestController {

    private final RequestQueryService queries;

    public RequestController(RequestQueryService queries) {
        this.queries = queries;
    }

    /** Requests of one project or of a customer, newest first. Dates are KST calendar dates (inclusive). */
    @GetMapping
    public PageResponse<RequestSummary> list(
            @AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ContentType type,
            @RequestParam(required = false) RequestStatus status,
            @RequestParam(required = false) Long primaryReviewerId,
            @RequestParam(required = false) Long reviewerId,
            @RequestParam(required = false) Long leadUserId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate submittedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate submittedTo,
            @RequestParam(required = false, defaultValue = "false") boolean mine,
            @RequestParam(required = false) RequestView view,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        RequestQueryService.ListQuery query = new RequestQueryService.ListQuery(projectId, customerId, q, type, status,
                primaryReviewerId, reviewerId, leadUserId, dueFrom, dueTo, submittedFrom, submittedTo, mine, view);
        return queries.list(auth, query, PageQuery.of(page, size));
    }

    @GetMapping("/{id}")
    public RequestDetail detail(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        return queries.detail(auth, id);
    }

    @GetMapping("/{id}/contents/{key}/versions/{version}")
    public ContentVersionResponse contentVersion(@AuthenticationPrincipal AuthUser auth, @PathVariable String id,
            @PathVariable String key, @PathVariable int version) {
        return queries.contentVersion(auth, id, key, version);
    }

    /** Business history in chronological order. */
    @GetMapping("/{id}/history")
    public List<HistoryEntryResponse> history(@AuthenticationPrincipal AuthUser auth, @PathVariable String id) {
        return queries.history(auth, id);
    }
}
