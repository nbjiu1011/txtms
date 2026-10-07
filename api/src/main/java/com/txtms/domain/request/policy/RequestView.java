package com.txtms.domain.request.policy;

/**
 * Named list conditions shared by the request list ({@code view}), dashboard KPIs and the review/approval screens.
 * Predicates live in {@link RequestPolicy#matches}.
 */
public enum RequestView {
    MY_DRAFT,
    MY_CONFIRMING,
    MY_IN_PROGRESS,
    MY_REVIEW,
    RECALL_PENDING,
    WAITING_ASSIGNMENT,
    OVERDUE,
    DUE_SOON,
    APPROVAL_PENDING,
    CUSTOMER_IN_PROGRESS(true),
    CUSTOMER_COMPLETED(true),
    MY_ASSIGNED_ACTIVE,
    MY_ASSIGNED_DONE,
    /** Requests I am assigned to that wait for the requester's answer (reviewer KPI "확인 요청", plan §30). */
    MY_ASSIGNED_CONFIRMING,
    APPROVAL_QUEUE,
    APPROVAL_PROCESSED;

    private final boolean customerScoped;

    RequestView() {
        this(false);
    }

    RequestView(boolean customerScoped) {
        this.customerScoped = customerScoped;
    }

    /** Customer-wide views require {@code customerId}. */
    public boolean customerScoped() {
        return customerScoped;
    }
}
