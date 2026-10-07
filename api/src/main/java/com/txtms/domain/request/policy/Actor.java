package com.txtms.domain.request.policy;

import java.util.Set;

/** The user a permission is evaluated for. */
public record Actor(long userId, Long customerId, boolean active, boolean operator, Set<Long> adminCustomerIds) {

    public Actor {
        adminCustomerIds = Set.copyOf(adminCustomerIds);
    }

    /** Actor without a home customer (policy tests, operators). */
    public Actor(long userId, boolean active, boolean operator, Set<Long> adminCustomerIds) {
        this(userId, null, active, operator, adminCustomerIds);
    }

    /** The customer is the user's own or one they administer. */
    public boolean belongsTo(long customerId) {
        return this.customerId != null && this.customerId == customerId || adminOf(customerId);
    }

    public boolean adminOf(long customerId) {
        return adminCustomerIds.contains(customerId);
    }
}
