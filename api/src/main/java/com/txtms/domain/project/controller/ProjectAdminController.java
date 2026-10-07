package com.txtms.domain.project.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.project.dto.ProjectBody;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.service.ProjectAdminService;
import com.txtms.global.security.AuthUser;

/** Project management of the customer admin (contract §11). */
@RestController
@RequestMapping("/api")
public class ProjectAdminController {

    private final ProjectAdminService projects;

    public ProjectAdminController(ProjectAdminService projects) {
        this.projects = projects;
    }

    @PostMapping("/customers/{customerId}/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestBody(required = false) ProjectBody body) {
        return projects.create(auth, customerId, body);
    }

    @PatchMapping("/projects/{projectId}")
    public ProjectResponse update(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId,
            @RequestBody(required = false) ProjectBody body) {
        return projects.update(auth, projectId, body);
    }
}
