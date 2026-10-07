package com.txtms.domain.customer.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.dto.CustomerResponse;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.user.dto.UserSummary;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.security.AuthUser;

/** Organization read model: customers, their projects and users, scoped to the caller. */
@Service
@Transactional(readOnly = true)
public class CustomerQueryService {

    /** Server-side cap for small, non-paged lists. */
    static final int LIST_LIMIT = 500;

    private final ProjectAccess projectAccess;
    private final UserService userService;

    public CustomerQueryService(ProjectAccess projectAccess, UserService userService) {
        this.projectAccess = projectAccess;
        this.userService = userService;
    }

    public List<CustomerResponse> customers(AuthUser auth) {
        User user = userService.require(auth.userId());
        return projectAccess.accessibleCustomers(user).stream().limit(LIST_LIMIT).map(CustomerResponse::of).toList();
    }

    public List<ProjectResponse> projects(AuthUser auth, long customerId) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        return projectAccess.readableProjects(user, customer).stream()
                .limit(LIST_LIMIT).map(ProjectResponse::of).toList();
    }

    public ProjectResponse project(AuthUser auth, long projectId) {
        User user = userService.require(auth.userId());
        return ProjectResponse.of(projectAccess.requireReadableProject(user, projectId));
    }

    public List<UserSummary> users(AuthUser auth, long customerId) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        return userService.byCustomer(customer.getId()).stream()
                .limit(LIST_LIMIT).map(UserService::summary).toList();
    }
}
