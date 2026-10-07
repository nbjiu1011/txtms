package com.txtms.domain.project.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.repository.ProjectRepository;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.exception.BusinessException;

/**
 * Customer and project scoping. Anything outside the caller's tenant scope is reported as {@code NOT_FOUND}.
 * <ul>
 * <li>Customers: own customer, customers the user administers (active only); operators see all customers.</li>
 * <li>Project metadata: members, admins of the customer, operators.</li>
 * <li>Project work (requests, dashboard): members and admins of the customer only — operators never see content.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class ProjectAccess {

    private final ProjectRepository projectRepository;
    private final CustomerService customerService;
    private final UserService userService;

    public ProjectAccess(ProjectRepository projectRepository, CustomerService customerService,
            UserService userService) {
        this.projectRepository = projectRepository;
        this.customerService = customerService;
        this.userService = userService;
    }

    public List<Customer> accessibleCustomers(User user) {
        return customerService.all().stream().filter(c -> canSeeCustomer(user, c)).toList();
    }

    public Customer requireAccessibleCustomer(User user, long customerId) {
        Customer customer = customerService.find(customerId).orElseThrow(BusinessException::notFound);
        if (!canSeeCustomer(user, customer)) {
            throw BusinessException.notFound();
        }
        return customer;
    }

    /** Projects of the customer whose metadata the user may read. */
    public List<Project> readableProjects(User user, Customer customer) {
        List<Project> projects = projectRepository.findByCustomerIdOrderByIdAsc(customer.getId());
        if (user.isOperator() || user.isAdminOf(customer.getId())) {
            return projects;
        }
        return projects.stream().filter(p -> !p.rolesOf(user.getId()).isEmpty()).toList();
    }

    public Project requireReadableProject(User user, long projectId) {
        Project project = projectRepository.findById(projectId).orElseThrow(BusinessException::notFound);
        Customer customer = requireAccessibleCustomer(user, project.getCustomerId());
        boolean allowed = user.isOperator() || user.isAdminOf(customer.getId())
                || !project.rolesOf(user.getId()).isEmpty();
        if (!allowed) {
            throw BusinessException.notFound();
        }
        return project;
    }

    /** Project whose requests the user may work with (member or customer admin). */
    public Project requireWorkProject(User user, long projectId) {
        Project project = projectRepository.findById(projectId).orElseThrow(BusinessException::notFound);
        if (!canWorkIn(user, project)) {
            throw BusinessException.notFound();
        }
        return project;
    }

    public Project requireProject(long projectId) {
        return projectRepository.findById(projectId).orElseThrow(BusinessException::notFound);
    }

    /**
     * Projects whose requests a list query covers: one project, or every workable project of a customer.
     */
    public List<Project> requestScope(User user, Long projectId, Long customerId) {
        if (projectId != null) {
            Project project = requireWorkProject(user, projectId);
            if (customerId != null && !customerId.equals(project.getCustomerId())) {
                throw BusinessException.notFound();
            }
            return List.of(project);
        }
        if (customerId == null) {
            throw BusinessException.validation("projectId", "projectId 또는 customerId를 지정하세요");
        }
        Customer customer = requireAccessibleCustomer(user, customerId);
        return projectRepository.findByCustomerIdOrderByIdAsc(customer.getId()).stream()
                .filter(p -> canWorkIn(user, p))
                .toList();
    }

    /** Projects where the user holds at least one role, ordered by id. */
    public List<Project> memberships(long userId) {
        return projectRepository.findByMemberUserId(userId);
    }

    public boolean canWorkIn(User user, Project project) {
        if (user.isOperator()) {
            return false;
        }
        Customer customer = customerService.find(project.getCustomerId()).orElse(null);
        if (customer == null || !customer.isActive()) {
            return false;
        }
        boolean ownOrAdmin = project.getCustomerId().equals(user.getCustomerId())
                || user.isAdminOf(project.getCustomerId());
        return ownOrAdmin && (user.isAdminOf(project.getCustomerId()) || !project.rolesOf(user.getId()).isEmpty());
    }

    public ProjectFacts facts(Project project) {
        return factsOf(List.of(project)).get(project.getId());
    }

    /** Policy facts for each project (customer flags and active members loaded in bulk). */
    public Map<Long, ProjectFacts> factsOf(Collection<Project> projects) {
        Set<Long> customerIds = projects.stream().map(Project::getCustomerId).collect(Collectors.toSet());
        Map<Long, Customer> customers = customerService.byIds(customerIds);
        Set<Long> memberIds = new HashSet<>();
        projects.forEach(p -> memberIds.addAll(p.roleMap().keySet()));
        Set<Long> activeIds = userService.byIds(memberIds).values().stream()
                .filter(User::isActive)
                .map(User::getId)
                .collect(Collectors.toSet());
        Map<Long, ProjectFacts> result = new LinkedHashMap<>();
        for (Project p : projects) {
            Customer c = customers.get(p.getCustomerId());
            Set<Long> projectActive = new HashSet<>(p.roleMap().keySet());
            projectActive.retainAll(activeIds);
            result.put(p.getId(), new ProjectFacts(p.getId(), p.getCustomerId(), p.getName(), p.isActive(),
                    c != null && c.isActive(), c != null && c.isApprovalEnabled(),
                    c == null ? 0 : c.getDueSoonDays(), p.getLeadUserId(), p.roleMap(), projectActive));
        }
        return result;
    }

    /** Project variables changed: correction results checked against the old revision become stale. */
    @Transactional
    public void bumpVariablesRevision(long projectId) {
        projectRepository.incrementVariablesRevision(projectId);
    }

    /** Number of projects per customer id (active and stopped). */
    public Map<Long, Long> projectCounts() {
        Map<Long, Long> counts = new java.util.HashMap<>();
        for (Object[] row : projectRepository.countByCustomer()) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    public List<Project> byCustomer(long customerId) {
        return new ArrayList<>(projectRepository.findByCustomerIdOrderByIdAsc(customerId));
    }

    private boolean canSeeCustomer(User user, Customer customer) {
        if (!customer.isActive()) {
            return false;
        }
        return user.isOperator() || customer.getId().equals(user.getCustomerId()) || user.isAdminOf(customer.getId());
    }
}
