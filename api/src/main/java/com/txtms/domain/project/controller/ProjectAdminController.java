package com.txtms.domain.project.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.project.dto.ProjectBody;
import com.txtms.domain.project.dto.ProjectMembersBody;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.service.ProjectAdminService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.security.AuthUser;

/** Project management of the customer admin (contract §11). */
@RestController
@RequestMapping("/api")
public class ProjectAdminController {

    private final ProjectAdminService projects;

    public ProjectAdminController(ProjectAdminService projects) {
        this.projects = projects;
    }

    /** 프로젝트 관리 list (the shell keeps the reference list {@code GET /api/customers/{id}/projects}). */
    @GetMapping("/customers/{customerId}/projects/manage")
    public PageResponse<ProjectResponse> manage(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return projects.manage(auth, customerId, PageQuery.of(page, size));
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

    /** Participation of the project: the whole member list with roles (contract §24). */
    @PutMapping("/projects/{projectId}/members")
    public ProjectResponse replaceMembers(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId,
            @RequestBody(required = false) ProjectMembersBody body) {
        return projects.replaceMembers(auth, projectId, body);
    }

    /** Only a project without history; others are kept by stopping them (contract §24). */
    @DeleteMapping("/projects/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId) {
        projects.delete(auth, projectId);
    }
}
