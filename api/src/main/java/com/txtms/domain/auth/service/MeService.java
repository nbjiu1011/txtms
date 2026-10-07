package com.txtms.domain.auth.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.dto.AuthDtos.UpdateMeRequest;
import com.txtms.domain.auth.dto.MeResponse;
import com.txtms.domain.auth.entity.UserSession;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.security.AuthUser;

/** Builds the Me resource (profile, admin customers, active project memberships, session). */
@Service
public class MeService {

    private final UserService userService;
    private final CustomerService customerService;
    private final ProjectAccess projectAccess;
    private final SessionService sessionService;
    private final Clock clock;

    public MeService(UserService userService, CustomerService customerService, ProjectAccess projectAccess,
            SessionService sessionService, Clock clock) {
        this.userService = userService;
        this.customerService = customerService;
        this.projectAccess = projectAccess;
        this.sessionService = sessionService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MeResponse me(AuthUser authUser) {
        User user = userService.require(authUser.userId());
        return build(user, sessionService.require(authUser.sessionId()));
    }

    @Transactional
    public MeResponse update(AuthUser authUser, UpdateMeRequest request) {
        User user = userService.require(authUser.userId());
        String dept = request.dept() == null || request.dept().isBlank() ? null : request.dept().trim();
        user.updateProfile(request.name().trim(), dept, clock.instant());
        return build(user, sessionService.require(authUser.sessionId()));
    }

    @Transactional(readOnly = true)
    public MeResponse build(User user, UserSession session) {
        List<Project> projects = projectAccess.memberships(user.getId());
        Map<Long, Customer> customers = customerService.byIds(
                projects.stream().map(Project::getCustomerId).collect(Collectors.toSet()));
        List<MeResponse.Membership> memberships = new ArrayList<>();
        for (Project p : projects) {
            Customer c = customers.get(p.getCustomerId());
            if (!p.isActive() || c == null || !c.isActive()) {
                continue;
            }
            List<ProjectRole> roles = p.rolesOf(user.getId()).stream().sorted().toList();
            memberships.add(new MeResponse.Membership(p.getId(), p.getCustomerId(), roles,
                    user.getId().equals(p.getLeadUserId())));
        }
        List<Long> adminCustomerIds = userService.actorOf(user).adminCustomerIds().stream().sorted().toList();
        return new MeResponse(user.getId(), user.getName(), user.getDept(), user.getEmail(), user.getCustomerId(),
                user.isOperator(), adminCustomerIds, user.getAvatarColor(), session.isDemo(), memberships,
                new MeResponse.SessionInfo(session.isRemember(), sessionService.expiresAt(session)));
    }
}
