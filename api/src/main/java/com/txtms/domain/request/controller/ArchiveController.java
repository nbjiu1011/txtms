package com.txtms.domain.request.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.request.dto.response.ArchiveLineResponse;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.service.ArchiveLines;
import com.txtms.domain.request.service.ArchiveService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

/** Completed-content archive of a project. */
@RestController
@RequestMapping("/api/archive")
public class ArchiveController {

    private final ArchiveService archive;

    public ArchiveController(ArchiveService archive) {
        this.archive = archive;
    }

    /** Content lines, latest completion first. Dates are KST calendar dates (inclusive). */
    @GetMapping("/contents")
    public PageResponse<ArchiveLineResponse> contents(
            @AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) ContentType type,
            @RequestParam(required = false) String campaign,
            @RequestParam(required = false) RequestStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate completedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate completedTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return archive.lines(auth, projectId,
                new ArchiveLines.Criteria(q, type, campaign, status, completedFrom, completedTo),
                PageQuery.of(page, size));
    }

    @GetMapping("/campaigns")
    public List<String> campaigns(@AuthenticationPrincipal AuthUser auth,
            @RequestParam(required = false) Long projectId) {
        return archive.campaigns(auth, projectId);
    }
}
