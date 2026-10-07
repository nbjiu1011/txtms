package com.txtms.domain.customer.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.txtms.domain.customer.dto.CustomerResponse;
import com.txtms.domain.customer.service.CustomerQueryService;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.user.dto.UserSummary;
import com.txtms.global.security.AuthUser;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerQueryService queries;

    public CustomerController(CustomerQueryService queries) {
        this.queries = queries;
    }

    /** Customers the user belongs to or administers; operators see all customers. */
    @GetMapping
    public List<CustomerResponse> customers(@AuthenticationPrincipal AuthUser auth) {
        return queries.customers(auth);
    }

    /** Projects of the customer where the user is a member, or all of them for admins and operators. */
    @GetMapping("/{customerId}/projects")
    public List<ProjectResponse> projects(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId) {
        return queries.projects(auth, customerId);
    }

    /** Users of the customer (active and inactive) for names and avatars. */
    @GetMapping("/{customerId}/users")
    public List<UserSummary> users(@AuthenticationPrincipal AuthUser auth, @PathVariable long customerId) {
        return queries.users(auth, customerId);
    }
}
