package com.txtms.domain.user.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.service.InvitationService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerAdminAccess;
import com.txtms.domain.customer.service.CustomerAdminAccess.Admin;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.project.service.ProjectRoleRules;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.policy.ProjectFacts;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.user.dto.MemberBodies.EmailBody;
import com.txtms.domain.user.dto.MemberBodies.InvitationBody;
import com.txtms.domain.user.dto.MemberBodies.ProjectRolesBody;
import com.txtms.domain.user.dto.MemberBodies.ProjectRolesItem;
import com.txtms.domain.user.dto.MemberBodies.SetupInvitationBody;
import com.txtms.domain.user.dto.MemberResponse;
import com.txtms.domain.user.entity.User;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * User management of the customer admin (actions.md §2.2 {@code inviteUser}/{@code inviteResend}/{@code userEmail},
 * §2.13 {@code roleEdit}): member list, project roles, invitations and their reissue, email change. Every change is
 * audited ({@code 역할 변경}, {@code 사용자 초대}, {@code 초대 재발급}, {@code 사용자 이메일 변경}).
 */
@Service
@Transactional
public class MemberAdminService {

    static final int LIST_LIMIT = 500;
    static final String INVITED_COLOR = "#6A6F7A";
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Set<RequestStatus> REVIEW_IN_PROGRESS = Set.of(RequestStatus.IN_REVIEW,
            RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);

    private final CustomerAdminAccess adminAccess;
    private final UserService userService;
    private final ProjectAccess projectAccess;
    private final RequestQueryService requests;
    private final InvitationService invitations;
    private final AuditLogService audit;
    private final Clock clock;

    public MemberAdminService(CustomerAdminAccess adminAccess, UserService userService, ProjectAccess projectAccess,
            RequestQueryService requests, InvitationService invitations, AuditLogService audit, Clock clock) {
        this.adminAccess = adminAccess;
        this.userService = userService;
        this.projectAccess = projectAccess;
        this.requests = requests;
        this.invitations = invitations;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ members

    @Transactional(readOnly = true)
    public List<MemberResponse> members(AuthUser auth, long customerId) {
        Admin admin = adminAccess.require(auth, customerId);
        List<User> users = userService.byCustomer(admin.customerId()).stream().limit(LIST_LIMIT).toList();
        List<Project> projects = projectAccess.byCustomer(admin.customerId());
        Map<Long, Instant> expiries = invitations.usableExpiries(
                users.stream().filter(User::isPending).map(User::getId).toList());
        return users.stream().map(u -> member(admin.customer(), u, projects, expiries.get(u.getId()))).toList();
    }

    MemberResponse member(Customer customer, User user) {
        Map<Long, Instant> expiries = user.isPending() ? invitations.usableExpiries(List.of(user.getId())) : Map.of();
        return member(customer, user, projectAccess.byCustomer(customer.getId()), expiries.get(user.getId()));
    }

    private static MemberResponse member(Customer customer, User user, List<Project> projects,
            Instant invitationExpiresAt) {
        List<MemberResponse.ProjectRoles> rows = new ArrayList<>();
        for (Project p : projects) {
            Set<ProjectRole> roles = p.rolesOf(user.getId());
            boolean lead = user.getId().equals(p.getLeadUserId());
            if (!roles.isEmpty() || lead) {
                rows.add(new MemberResponse.ProjectRoles(p.getId(), roles.stream().sorted().toList(), lead));
            }
        }
        return new MemberResponse(UserService.summary(user), user.isPending(), user.isAdminOf(customer.getId()),
                rows, user.isPending() ? invitationExpiresAt : null);
    }

    // ------------------------------------------------------------------ roles

    /**
     * Sets the user's roles in the listed projects (other projects unchanged; empty roles remove the membership).
     * Every project is checked first ({@link ProjectRoleRules#problem}); nothing changes when one fails.
     */
    public MemberResponse updateRoles(AuthUser auth, long customerId, long userId, ProjectRolesBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        List<ProjectRolesItem> items = body == null || body.projects() == null ? List.of() : body.projects();
        Map<Long, Project> byId = new LinkedHashMap<>();
        projectAccess.byCustomer(admin.customerId()).forEach(p -> byId.put(p.getId(), p));

        Map<Project, Set<ProjectRole>> changes = new LinkedHashMap<>();
        for (int i = 0; i < items.size(); i++) {
            ProjectRolesItem item = items.get(i);
            if (item == null || item.projectId() == null) {
                throw BusinessException.validation("projects." + i + ".projectId", "프로젝트를 선택하세요");
            }
            Project project = byId.get(item.projectId());
            if (project == null) {
                throw BusinessException.notFound();
            }
            if (changes.containsKey(project)) {
                throw BusinessException.validation("projects." + i + ".projectId", "같은 프로젝트를 두 번 보냈습니다");
            }
            Set<ProjectRole> after = EnumSet.noneOf(ProjectRole.class);
            if (item.roles() != null) {
                item.roles().stream().filter(java.util.Objects::nonNull).forEach(after::add);
            }
            Set<ProjectRole> before = project.rolesOf(target.getId());
            if (before.equals(after)) {
                continue;
            }
            String problem = ProjectRoleRules.problem(facts(admin, project, target), before, after);
            if (problem != null) {
                throw new BusinessException(ErrorCode.VALIDATION_FAILED, problem);
            }
            changes.put(project, after);
        }
        if (!changes.isEmpty()) {
            List<String> parts = new ArrayList<>();
            changes.forEach((project, after) -> {
                parts.add(project.getName() + ": " + ProjectRoleRules.label(project.rolesOf(target.getId())) + " → "
                        + ProjectRoleRules.label(after));
                project.replaceRoles(target.getId(), after);
            });
            audit.record(admin.userId(), admin.customerId(), "역할 변경", target.getName(), String.join(" / ", parts));
        }
        return member(admin.customer(), target);
    }

    private ProjectRoleRules.Facts facts(Admin admin, Project project, User target) {
        ProjectFacts facts = projectAccess.facts(project);
        boolean assigned = requests.visible(userService.actorOf(admin.user()), List.of(project)).stream()
                .map(ScopedRequest::request)
                .anyMatch(r -> REVIEW_IN_PROGRESS.contains(r.getStatus()) && r.getReviewerIds().contains(target.getId()));
        List<Long> approvers = facts.activeApprovers();
        return new ProjectRoleRules.Facts(project.getName(), admin.customer().isApprovalEnabled(),
                target.getId().equals(project.getLeadUserId()), assigned,
                approvers.size() == 1 && approvers.getFirst().equals(target.getId()));
    }

    // ------------------------------------------------------------------ invitations

    /**
     * Creates a pending account (globally unique email) with an optional first project role and sends a 7-day
     * invitation link. An email outside the customer's domain needs {@code externalDomainConfirmed}.
     */
    public MemberResponse invite(AuthUser auth, long customerId, InvitationBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        InvitationBody b = body == null ? new InvitationBody(null, null, null, null, null, null) : body;
        String email = b.email() == null ? "" : b.email().trim().toLowerCase();
        if (email.isEmpty()) {
            throw BusinessException.validation("email", "이메일을(를) 입력하세요");
        }
        String name = b.name() == null ? "" : b.name().trim();
        if (name.isEmpty()) {
            throw BusinessException.validation("name", "이름을(를) 입력하세요");
        }
        if (name.length() > 100) {
            throw BusinessException.validation("name", "이름은 최대 100자입니다");
        }
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw BusinessException.validation("email", "이메일 형식을 확인하세요");
        }
        String dept = b.dept() == null || b.dept().isBlank() ? null : b.dept().trim();
        if (dept != null && dept.length() > 100) {
            throw BusinessException.validation("dept", "소속은 최대 100자입니다");
        }
        Project project = null;
        if (b.projectId() != null || b.role() != null) {
            if (b.projectId() == null) {
                throw BusinessException.validation("projectId", "프로젝트를 선택하세요");
            }
            if (b.role() == null) {
                throw BusinessException.validation("role", "역할을 선택하세요");
            }
            project = projectAccess.byCustomer(admin.customerId()).stream()
                    .filter(p -> p.getId().equals(b.projectId())).findFirst()
                    .orElseThrow(BusinessException::notFound);
            if (b.role() == ProjectRole.APPROVER && !admin.customer().isApprovalEnabled()) {
                throw BusinessException.validation("role", ProjectRoleRules.APPROVAL_NOT_USED);
            }
        }
        if (userService.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE, "이미 등록된 이메일입니다");
        }
        requireDomainConfirmed(admin.customer(), email, b.externalDomainConfirmed(),
                "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다");

        User user = userService.create(User.invited(admin.customerId(), email, name, dept, INVITED_COLOR,
                clock.instant()));
        if (project != null) {
            project.addRole(user.getId(), b.role());
        }
        invitations.issue(user, admin.userId(), admin.customer().getName());
        audit.record(admin.userId(), admin.customerId(), "사용자 초대", name, email);
        return member(admin.customer(), user);
    }

    /**
     * Operator initial-setup invitation (actions.md §2.14 {@code seedUser}, prototype J:216 + J:289). The caller has
     * checked the operator and that the customer is active. Order: email and name required → format or duplicate
     * ({@code 이메일 형식 또는 중복을 확인하세요}) → a work user needs a project ({@code 프로젝트가 필요합니다}) and a role →
     * external domain confirmation. {@code admin} grants the customer admin right, effective once the invitation is
     * accepted (a pending account cannot sign in). Audited as {@code 사용자 초대} with the operator as actor.
     */
    public MemberResponse inviteForSetup(Customer customer, long operatorId, SetupInvitationBody body) {
        SetupInvitationBody b = body == null ? new SetupInvitationBody(null, null, null, null, null, null, null)
                : body;
        boolean asAdmin = Boolean.TRUE.equals(b.admin());
        String email = b.email() == null ? "" : b.email().trim().toLowerCase();
        if (email.isEmpty()) {
            throw BusinessException.validation("email", "이메일을(를) 입력하세요");
        }
        String name = b.name() == null ? "" : b.name().trim();
        if (name.isEmpty()) {
            throw BusinessException.validation("name", "이름을(를) 입력하세요");
        }
        if (name.length() > 100) {
            throw BusinessException.validation("name", "이름은 최대 100자입니다");
        }
        String invalid = "이메일 형식 또는 중복을 확인하세요";
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw BusinessException.validation("email", invalid);
        }
        if (userService.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE, invalid);
        }
        String dept = b.dept() == null || b.dept().isBlank() ? null : b.dept().trim();
        if (dept != null && dept.length() > 100) {
            throw BusinessException.validation("dept", "소속은 최대 100자입니다");
        }
        Project project = null;
        if (!asAdmin || b.projectId() != null || b.role() != null) {
            if (b.projectId() == null) {
                throw BusinessException.validation("projectId", "프로젝트가 필요합니다");
            }
            if (b.role() == null) {
                throw BusinessException.validation("role", "역할을 선택하세요");
            }
            project = projectAccess.byCustomer(customer.getId()).stream()
                    .filter(p -> p.getId().equals(b.projectId())).findFirst()
                    .orElseThrow(BusinessException::notFound);
            if (b.role() == ProjectRole.APPROVER && !customer.isApprovalEnabled()) {
                throw BusinessException.validation("role", ProjectRoleRules.APPROVAL_NOT_USED);
            }
        }
        requireDomainConfirmed(customer, email, b.externalDomainConfirmed(),
                "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다");

        User user = User.invited(customer.getId(), email, name, dept, INVITED_COLOR, clock.instant());
        if (asAdmin) {
            user.grantCustomerAdmin(customer.getId());
        }
        user = userService.create(user);
        if (project != null) {
            project.addRole(user.getId(), b.role());
        }
        invitations.issue(user, operatorId, customer.getName());
        String what = asAdmin ? "고객사 관리자" : "업무 사용자";
        if (project != null) {
            what += ", " + project.getName() + " " + ProjectRoleRules.label(b.role());
        }
        audit.record(operatorId, customer.getId(), "사용자 초대", name, email + " (" + what + ")");
        return member(customer, user);
    }

    /** Pending users only: every unused link is revoked and a new 7-day link is mailed. */
    public void reissue(AuthUser auth, long customerId, long userId) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        if (!target.isPending()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "초대 대기 중인 사용자만 초대 링크를 재발급할 수 있습니다");
        }
        invitations.issue(target, admin.userId(), admin.customer().getName());
        audit.record(admin.userId(), admin.customerId(), "초대 재발급", target.getName(), target.getEmail());
    }

    /** Email change (globally unique). A pending user gets a new invitation link at the new address. */
    public MemberResponse changeEmail(AuthUser auth, long customerId, long userId, EmailBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        User target = adminAccess.requireCustomerUser(admin, userId);
        String email = body == null || body.email() == null ? "" : body.email().trim().toLowerCase();
        String invalid = "이메일 형식 또는 중복을 확인하세요";
        if (email.isEmpty() || email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw BusinessException.validation("email", invalid);
        }
        if (email.equals(target.getEmail())) {
            return member(admin.customer(), target);
        }
        if (userService.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE, invalid);
        }
        requireDomainConfirmed(admin.customer(), email, body.externalDomainConfirmed(),
                "회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 다시 저장하면 변경됩니다");
        String before = target.getEmail();
        target.changeEmail(email, clock.instant());
        if (target.isPending()) {
            invitations.issue(target, admin.userId(), admin.customer().getName());
        }
        audit.record(admin.userId(), admin.customerId(), "사용자 이메일 변경", target.getName(), before + " → " + email);
        return member(admin.customer(), target);
    }

    /** An email outside the customer's domain is accepted only with the confirmation flag (prototype J:289). */
    static void requireDomainConfirmed(Customer customer, String email, Boolean confirmed, String message) {
        String domain = email.substring(email.lastIndexOf('@') + 1);
        if (!domain.equals(customer.getDomain()) && !Boolean.TRUE.equals(confirmed)) {
            throw new BusinessException(ErrorCode.EXTERNAL_DOMAIN_CONFIRM_REQUIRED, message);
        }
    }

}
