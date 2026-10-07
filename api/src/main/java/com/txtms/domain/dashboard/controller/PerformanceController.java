package com.txtms.domain.dashboard.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.dashboard.dto.PerformanceResponse;
import com.txtms.domain.dashboard.service.PerformanceService;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/performance")
public class PerformanceController {

    private final PerformanceService performance;

    public PerformanceController(PerformanceService performance) {
        this.performance = performance;
    }

    /** Received/completed statistics, people and workload of the caller's managed projects (KST dates inclusive). */
    @GetMapping
    public PerformanceResponse performance(@AuthenticationPrincipal AuthUser auth, @RequestParam long customerId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long userId) {
        return performance.performance(auth, customerId, projectId, from, to, userId);
    }
}
