package com.txtms.domain.dashboard.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.customer.service.CustomerQueryService;
import com.txtms.domain.dashboard.dto.DashboardResponse;
import com.txtms.domain.dashboard.dto.WorkloadRow;
import com.txtms.domain.dashboard.service.DashboardService;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class ProjectController {

    private final CustomerQueryService organization;
    private final DashboardService dashboards;

    public ProjectController(CustomerQueryService organization, DashboardService dashboards) {
        this.organization = organization;
        this.dashboards = dashboards;
    }

    @GetMapping
    public ProjectResponse project(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId) {
        return organization.project(auth, projectId);
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId) {
        return dashboards.dashboard(auth, projectId);
    }

    @GetMapping("/workload")
    public List<WorkloadRow> workload(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId) {
        return dashboards.workload(auth, projectId);
    }
}
