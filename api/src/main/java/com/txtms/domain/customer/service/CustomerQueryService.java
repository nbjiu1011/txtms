package com.txtms.domain.customer.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.dto.CustomerResponse;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.service.RequestStatsService;
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
    private final RequestStatsService requestStats;

    public CustomerQueryService(ProjectAccess projectAccess, UserService userService,
            RequestStatsService requestStats) {
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.requestStats = requestStats;
    }

    public List<CustomerResponse> customers(AuthUser auth) {
        User user = userService.require(auth.userId());
        return projectAccess.accessibleCustomers(user).stream().limit(LIST_LIMIT).map(CustomerResponse::of).toList();
    }

    public List<ProjectResponse> projects(AuthUser auth, long customerId) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        List<Project> projects = projectAccess.readableProjects(user, customer).stream().limit(LIST_LIMIT).toList();
        if (!userService.actorOf(user).adminOf(customer.getId())) {
            return projects.stream().map(ProjectResponse::of).toList();
        }
        // customer admins also get the number of requests in progress per project
        Map<Long, Long> active = requestStats.activeCountsByProject(customer.getId());
        return projects.stream().map(p -> ProjectResponse.of(p, active.getOrDefault(p.getId(), 0L))).toList();
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
