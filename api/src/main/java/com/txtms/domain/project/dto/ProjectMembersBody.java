package com.txtms.domain.project.dto;

import java.util.List;

import com.txtms.domain.project.entity.ProjectRole;

/** The whole participation of a project (contract §24): listed users get exactly these roles, others are removed. */
public record ProjectMembersBody(List<Item> members) {

    public record Item(Long userId, List<ProjectRole> roles) {
    }
}
