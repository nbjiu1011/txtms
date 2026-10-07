package com.txtms.domain.ops.dto;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.request.dto.response.SampleRequestSummary;
import com.txtms.domain.user.dto.MemberResponse;
import com.txtms.domain.user.dto.UserSummary;
import com.txtms.global.audit.AuditLogService;

/** Request and response shapes of the solution operator API (contract §9 OpsDashboard, §12). */
public final class OpsDtos {

    private OpsDtos() {
    }

    // ------------------------------------------------------------------ requests

    public record CreateCustomerBody(String name, String domain, Boolean approvalEnabled) {
    }

    public record DeactivateCustomerBody(String reason) {
    }

    public record SetupProjectBody(String name, Long leadUserId) {
    }

    public record TemplateBody(String code, String name) {
    }

    public record ContentTypeActiveBody(Boolean active) {
    }

    public record SampleRequestBody(Long projectId, ContentType type) {
    }

    // ------------------------------------------------------------------ responses

    /**
     * Contract OpsCustomer = Customer (§2.1) + operator figures. {@code admins}: usable customer admin accounts;
     * {@code adminAssigned} = admins not empty; {@code unassignedDatasetTypes}: content types in use without an
     * effective dataset. Request figures are counts only (the operator never reads request content).
     * {@code createdByName}: the creator's current name (null when unknown, e.g. seeded customers).
     */
    public record OpsCustomer(long id, String name, String domain, boolean approvalEnabled, boolean active,
            boolean sample, NotifyChannel notifyChannel, int dueSoonDays, Instant createdAt, Long createdBy,
            String createdByName, String deactivationReason, long projectCount, long userCount, long requestCount,
            long activeRequestCount, long completedRequestCount, long sampleRequestCount, boolean adminAssigned,
            List<UserSummary> admins, List<ContentType> unassignedDatasetTypes) {

        public static OpsCustomer of(Customer c, String createdByName, long projectCount, long userCount,
                long requestCount, long activeRequestCount, long completedRequestCount, long sampleRequestCount,
                List<UserSummary> admins, List<ContentType> unassigned) {
            return new OpsCustomer(c.getId(), c.getName(), c.getDomain(), c.isApprovalEnabled(), c.isActive(),
                    c.isSample(), c.getNotifyChannel(), c.getDueSoonDays(), c.getCreatedAt(), c.getCreatedBy(),
                    createdByName, c.getDeactivationReason(), projectCount, userCount, requestCount, activeRequestCount,
                    completedRequestCount, sampleRequestCount, !admins.isEmpty(), List.copyOf(admins),
                    List.copyOf(unassigned));
        }
    }

    /**
     * Response of the operator invitation: Member (§11) + {@code mailId}, the outbox id of the invitation mail (its
     * link is shown by the operator outbox listing rules).
     */
    public record OpsInvitation(@JsonUnwrapped MemberResponse member, long mailId) {
    }

    /** Contract OpsDashboard (§9). */
    public record OpsDashboard(Kpis kpis, List<Todo> todos, List<OpsCustomer> customers,
            List<AuditLogService.Entry> recentAudit) {
    }

    /** Active customers, active customers without a usable admin, active customers with unassigned datasets. */
    public record Kpis(int activeCustomers, int customersWithoutAdmin, int customersWithUnassignedDatasets) {
    }

    /**
     * One remaining initial-setup step of an active customer. {@code kind}: {@code INVITE_ADMIN} / {@code
     * CREATE_PROJECT} / {@code ASSIGN_DATASETS}; {@code route}/{@code sub}: web route key to open ({@code opsSetup},
     * {@code opsStandards} + {@code assign}); {@code count}: unassigned combinations (dataset step only).
     */
    public record Todo(String kind, String label, String route, String sub, long customerId, String customerName,
            String customerDomain, boolean approvalEnabled, Integer count) {
    }

    /** Contract SetupLog (§12). */
    public record SetupLogEntry(long id, long customerId, Instant at, Long actorId, String actorName, String action,
            String target, String result) {
    }

    /** Sample requests of a customer and how many real requests stay untouched by the sample cleanup. */
    public record SampleOverview(long customerId, boolean sample, List<SampleRequestSummary> samples,
            long realRequestCount) {
    }

    /** Result of {@code POST /api/ops/sample-reset}. */
    public record SampleResetResult(List<Long> customerIds, int deletedRequests, int restoredRequests) {
    }
}
