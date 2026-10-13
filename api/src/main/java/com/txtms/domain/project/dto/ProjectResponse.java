package com.txtms.domain.project.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;

/**
 * Contract Project (§2.2). {@code activeRequestCount} (requests submitted and not finally completed) is given only
 * in the customer's project list for its admins, {@code deletable} (no history, contract §24) only in the 프로젝트 관리
 * list; for every other response the keys are left out.
 */
public record ProjectResponse(
        long id,
        long customerId,
        String name,
        boolean active,
        Long leadUserId,
        List<Template> templates,
        List<Member> members,
        int variablesRevision,
        @JsonInclude(JsonInclude.Include.NON_NULL) Long activeRequestCount,
        @JsonInclude(JsonInclude.Include.NON_NULL) Boolean deletable) {

    public record Template(String code, String name) {
    }

    public record Member(long userId, List<ProjectRole> roles) {
    }

    public static ProjectResponse of(Project p) {
        return of(p, null);
    }

    public static ProjectResponse of(Project p, Long activeRequestCount) {
        return of(p, activeRequestCount, null);
    }

    public static ProjectResponse of(Project p, Long activeRequestCount, Boolean deletable) {
        List<Template> templates = p.getTemplates().stream().map(t -> new Template(t.getCode(), t.getName())).toList();
        List<Member> members = p.roleMap().entrySet().stream()
                .map(e -> new Member(e.getKey(), e.getValue().stream().sorted().toList()))
                .toList();
        return new ProjectResponse(p.getId(), p.getCustomerId(), p.getName(), p.isActive(), p.getLeadUserId(),
                templates, members, p.getVariablesRevision(), activeRequestCount, deletable);
    }
}
