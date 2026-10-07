package com.txtms.domain.project.dto;

import java.util.List;

import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;

/** Contract Project (§2.2). */
public record ProjectResponse(
        long id,
        long customerId,
        String name,
        boolean active,
        Long leadUserId,
        List<Template> templates,
        List<String> senders,
        List<Member> members,
        int variablesRevision) {

    public record Template(String code, String name) {
    }

    public record Member(long userId, List<ProjectRole> roles) {
    }

    public static ProjectResponse of(Project p) {
        List<Template> templates = p.getTemplates().stream().map(t -> new Template(t.getCode(), t.getName())).toList();
        List<Member> members = p.roleMap().entrySet().stream()
                .map(e -> new Member(e.getKey(), e.getValue().stream().sorted().toList()))
                .toList();
        return new ProjectResponse(p.getId(), p.getCustomerId(), p.getName(), p.isActive(), p.getLeadUserId(),
                templates, p.getSenders(), members, p.getVariablesRevision());
    }
}
