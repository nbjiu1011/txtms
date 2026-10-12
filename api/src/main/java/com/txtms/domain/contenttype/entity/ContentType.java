package com.txtms.domain.contenttype.entity;

/** Content type of a request. All contents of a request share it. */
public enum ContentType {
    ALIMTALK,
    SMS,
    RCS,
    FREEFORM;

    /** Message of every refused new RCS content (clone, follow-up, datasets). */
    public static final String RCS_DEFERRED = "RCS 유형은 1차에서 제공하지 않습니다";

    /**
     * Offered in Phase 1. RCS is deferred (client decision 2026-10-12): it stays in the enum so existing RCS requests
     * remain readable and can finish their workflow, but it is never active, listed, managed or seeded.
     */
    public boolean offered() {
        return this != RCS;
    }
}
