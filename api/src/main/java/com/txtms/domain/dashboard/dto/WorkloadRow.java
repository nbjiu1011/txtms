package com.txtms.domain.dashboard.dto;

import java.util.List;

import com.txtms.domain.request.dto.response.Volume;

/**
 * Contract WorkloadRow: per active reviewer, requests in review / confirming / approval waiting where the reviewer
 * is assigned. {@code active} is that count.
 */
public record WorkloadRow(long userId, int active, int primary, int dueSoonOrOverdue, int chars,
        List<Volume.FileVolume> files) {
}
