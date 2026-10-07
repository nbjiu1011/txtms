package com.txtms.domain.project.dto;

import java.util.List;

/**
 * Project create / edit body (customer admin). On edit, omitted (null) keys keep the current value; {@code approverIds}
 * replaces the approver set when present.
 */
public record ProjectBody(String name, Long leadUserId, List<Long> approverIds, Boolean active) {
}
