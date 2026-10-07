package com.txtms.domain.project.entity;

/** Project-scoped roles. The lead reviewer is {@code project.leadUserId}, the primary reviewer is per request. */
public enum ProjectRole {
    REQUESTER,
    REVIEWER,
    APPROVER
}
