package com.txtms.domain.dashboard.dto;

import java.time.LocalDate;
import java.util.List;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.notice.dto.NoticeSummary;
import com.txtms.domain.request.dto.response.RequestSummary;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.RequestAction;
import com.txtms.domain.request.policy.RequestView;

/** Contract Dashboard (§9). {@code tone} is the request status whose color the item uses. */
public record DashboardResponse(
        List<Kpi> kpis,
        List<PipelineStage> pipeline,
        int pipelineTotal,
        List<Todo> todos,
        List<RequestSummary> recent,
        List<WorkloadRow> workload,
        List<NoticeSummary> notices,
        boolean adminViewing) {

    public record Kpi(RequestView view, String label, RequestStatus tone, int count) {
    }

    public record PipelineStage(RequestStatus status, int count) {
    }

    public record Todo(
            String requestId,
            RequestAction action,
            String label,
            RequestStatus tone,
            String title,
            ContentType type,
            String projectName,
            LocalDate dueDate,
            boolean overdue,
            boolean dueSoon) {
    }
}
