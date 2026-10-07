package com.txtms.domain.user.dto;

/** Contract UserSummary (§2.3). */
public record UserSummary(long id, String name, String dept, String email, boolean active, String avatarColor) {
}
