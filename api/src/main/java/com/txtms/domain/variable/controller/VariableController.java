package com.txtms.domain.variable.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.variable.dto.ProjectVariableLogResponse;
import com.txtms.domain.variable.dto.VariableCreateRequest;
import com.txtms.domain.variable.dto.VariableLogResponse;
import com.txtms.domain.variable.dto.VariableResponse;
import com.txtms.domain.variable.dto.VariableUpdateRequest;
import com.txtms.domain.variable.service.VariableService;
import com.txtms.global.security.AuthUser;

@RestController
public class VariableController {

    private final VariableService variables;

    public VariableController(VariableService variables) {
        this.variables = variables;
    }

    @GetMapping("/api/projects/{projectId}/variables")
    public List<VariableResponse> list(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId,
            @RequestParam(required = false) String q, @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return variables.list(auth, projectId, q, active, includeDeleted);
    }

    /** Change log of all variables of the project, newest first (customer admins). */
    @GetMapping("/api/projects/{projectId}/variable-logs")
    public List<ProjectVariableLogResponse> projectLogs(@AuthenticationPrincipal AuthUser auth,
            @PathVariable long projectId) {
        return variables.projectLogs(auth, projectId);
    }

    @PostMapping("/api/projects/{projectId}/variables")
    @ResponseStatus(HttpStatus.CREATED)
    public VariableResponse create(@AuthenticationPrincipal AuthUser auth, @PathVariable long projectId,
            @RequestBody VariableCreateRequest body) {
        return variables.create(auth, projectId, body);
    }

    @PatchMapping("/api/variables/{id}")
    public VariableResponse update(@AuthenticationPrincipal AuthUser auth, @PathVariable long id,
            @RequestBody VariableUpdateRequest body) {
        return variables.update(auth, id, body);
    }

    @DeleteMapping("/api/variables/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        variables.delete(auth, id);
    }

    @GetMapping("/api/variables/{id}/logs")
    public List<VariableLogResponse> logs(@AuthenticationPrincipal AuthUser auth, @PathVariable long id) {
        return variables.logs(auth, id);
    }
}
