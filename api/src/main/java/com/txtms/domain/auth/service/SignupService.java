package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.dto.AuthDtos.SignupCustomer;
import com.txtms.domain.auth.dto.AuthDtos.SignupOptions;
import com.txtms.domain.auth.dto.AuthDtos.SignupProject;
import com.txtms.domain.auth.dto.AuthDtos.SignupRequest;
import com.txtms.domain.auth.dto.AuthDtos.SignupRole;
import com.txtms.domain.auth.service.AuthService.LoginResult;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.project.service.ProjectRoleRules;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

/**
 * Temporary self sign-up so the client's staff can try every role on the development server. Open only in demo mode
 * with {@code app.demo.signup-enabled}; otherwise both endpoints answer {@code NOT_FOUND}. Accounts are demo accounts,
 * so they stop working as soon as demo mode is switched off, and the new user is logged in at once.
 */
@Service
public class SignupService {

    static final String DUPLICATE_EMAIL = "이미 가입된 이메일입니다";

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final List<String> AVATAR_COLORS = List.of("#3C6E71", "#4B5D9A", "#7A4A8C", "#8C5E3C", "#3A6E8F",
            "#5E7F3A", "#8A5F7A", "#45606B");

    private final UserService userService;
    private final CustomerService customerService;
    private final ProjectAccess projectAccess;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService audit;
    private final Clock clock;
    private final AppProperties properties;

    public SignupService(UserService userService, CustomerService customerService, ProjectAccess projectAccess,
            AuthService authService, PasswordEncoder passwordEncoder, AuditLogService audit, Clock clock,
            AppProperties properties) {
        this.userService = userService;
        this.customerService = customerService;
        this.projectAccess = projectAccess;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.clock = clock;
        this.properties = properties;
    }

    /** Active customers and their active projects (with the current lead reviewer), both in id order. */
    @Transactional(readOnly = true)
    public SignupOptions options() {
        requireOpen();
        List<Customer> customers = customerService.all().stream().filter(Customer::isActive)
                .sorted((a, b) -> Long.compare(a.getId(), b.getId())).toList();
        List<SignupCustomer> result = customers.stream().map(c -> {
            List<Project> projects = activeProjects(c.getId());
            Map<Long, User> leads = userService.byIds(projects.stream().map(Project::getLeadUserId)
                    .filter(Objects::nonNull).toList());
            List<SignupProject> items = projects.stream().map(p -> new SignupProject(p.getId(), p.getName(),
                    p.getLeadUserId() == null || !leads.containsKey(p.getLeadUserId()) ? null
                            : leads.get(p.getLeadUserId()).getName()))
                    .toList();
            return new SignupCustomer(c.getId(), c.getName(), c.isApprovalEnabled(), items);
        }).toList();
        return new SignupOptions(result);
    }

    @Transactional
    public LoginResult signup(SignupRequest body) {
        requireOpen();
        SignupRequest b = body == null ? new SignupRequest(null, null, null, null, null, null) : body;
        String name = b.name() == null ? "" : b.name().trim();
        if (name.isEmpty()) {
            throw BusinessException.validation("name", "이름을(를) 입력하세요");
        }
        if (name.length() > 100) {
            throw BusinessException.validation("name", "이름은 최대 100자입니다");
        }
        String email = b.email() == null ? "" : b.email().trim().toLowerCase();
        if (email.isEmpty()) {
            throw BusinessException.validation("email", "이메일을(를) 입력하세요");
        }
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw BusinessException.validation("email", "이메일 형식을 확인하세요");
        }
        String password = b.password() == null ? "" : b.password();
        if (PasswordPolicy.tooLong(password)) {
            throw BusinessException.validation("password", PasswordPolicy.TOO_LONG_MESSAGE);
        }
        if (!PasswordPolicy.satisfied(password)) {
            throw BusinessException.validation("password", PasswordPolicy.MESSAGE);
        }
        SignupRole role = b.role();
        if (role == null) {
            throw BusinessException.validation("role", "역할을 선택하세요");
        }

        Customer customer = null;
        Project project = null;
        if (role != SignupRole.OPERATOR) {
            customer = b.customerId() == null ? null
                    : customerService.find(b.customerId()).filter(Customer::isActive).orElse(null);
            if (customer == null) {
                throw BusinessException.validation("customerId", "고객사를 선택하세요");
            }
            if (role != SignupRole.CUSTOMER_ADMIN) {
                long customerId = customer.getId();
                project = b.projectId() == null ? null
                        : activeProjects(customerId).stream().filter(p -> p.getId().equals(b.projectId()))
                                .findFirst().orElse(null);
                if (project == null) {
                    throw BusinessException.validation("projectId", "프로젝트를 선택하세요");
                }
                if (role == SignupRole.APPROVER && !customer.isApprovalEnabled()) {
                    throw BusinessException.validation("role", ProjectRoleRules.APPROVAL_NOT_USED);
                }
            }
        }
        if (userService.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE, DUPLICATE_EMAIL);
        }

        Instant now = clock.instant();
        Long customerId = customer == null ? null : customer.getId();
        String color = AVATAR_COLORS.get(Math.floorMod(email.hashCode(), AVATAR_COLORS.size()));
        User user = userService.create(new User(customerId, email, name, null, role == SignupRole.OPERATOR, true,
                color, now));
        user.changePasswordHash(passwordEncoder.encode(password), now);
        switch (role) {
            case REQUESTER -> project.addRole(user.getId(), ProjectRole.REQUESTER);
            case REVIEWER -> project.addRole(user.getId(), ProjectRole.REVIEWER);
            case APPROVER -> project.addRole(user.getId(), ProjectRole.APPROVER);
            case LEAD_REVIEWER -> project.assignLead(user.getId());
            case CUSTOMER_ADMIN -> user.grantCustomerAdmin(customerId);
            case OPERATOR -> {
                // platform-wide role: no customer, no project
            }
        }
        String scope = customer == null ? "솔루션" : project == null ? customer.getName()
                : customer.getName() + " / " + project.getName();
        audit.record(user.getId(), customerId, "임시 가입", name, email + " · " + label(role) + " · " + scope);
        return authService.startSession(user, false);
    }

    static String label(SignupRole role) {
        return switch (role) {
            case REQUESTER -> "요청자";
            case REVIEWER -> "검수자";
            case LEAD_REVIEWER -> "대표 검수자";
            case APPROVER -> "승인자";
            case CUSTOMER_ADMIN -> "고객사 관리자";
            case OPERATOR -> "솔루션 운영 담당자";
        };
    }

    private List<Project> activeProjects(long customerId) {
        return projectAccess.byCustomer(customerId).stream().filter(Project::isActive)
                .sorted((a, b) -> Long.compare(a.getId(), b.getId())).toList();
    }

    private void requireOpen() {
        if (!properties.demo().signupAvailable()) {
            throw BusinessException.notFound();
        }
    }
}
