package com.txtms.domain.project.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerAdminAccess;
import com.txtms.domain.customer.service.CustomerAdminAccess.Admin;
import com.txtms.domain.project.dto.ProjectBody;
import com.txtms.domain.project.dto.ProjectMembersBody;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.entity.ProjectTemplate;
import com.txtms.domain.project.repository.ProjectRepository;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.service.ScopedRequest;
import com.txtms.domain.request.service.RequestStatsService;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Project management by the customer admin (actions.md §2.13 {@code projEdit}): name, lead reviewer (gets the
 * reviewer role; never a requester of the project), approver set (approval customers: at least one active approver;
 * other customers: none), active flag (deactivation refused while requests are in progress). Audited as
 * {@code 프로젝트 생성} / {@code 프로젝트 변경}. Participation (the whole member list with roles) and deleting a project
 * without history (contract §24) are audited as {@code 프로젝트 구성원 변경} / {@code 프로젝트 삭제}. Alimtalk templates
 * are set by the operator (contract §12).
 */
@Service
@Transactional
public class ProjectAdminService {

    static final int NAME_MAX = 100;
    private static final Set<RequestStatus> REVIEW_IN_PROGRESS = EnumSet.of(RequestStatus.IN_REVIEW,
            RequestStatus.CONFIRMING, RequestStatus.APPROVAL_WAITING);

    private final ProjectRepository projects;
    private final CustomerAdminAccess adminAccess;
    private final UserService userService;
    private final RequestQueryService requests;
    private final RequestStatsService requestStats;
    private final AuditLogService audit;
    private final Clock clock;

    public ProjectAdminService(ProjectRepository projects, CustomerAdminAccess adminAccess, UserService userService,
            RequestQueryService requests, RequestStatsService requestStats, AuditLogService audit, Clock clock) {
        this.projects = projects;
        this.adminAccess = adminAccess;
        this.userService = userService;
        this.requests = requests;
        this.requestStats = requestStats;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * 프로젝트 관리 list: every project of the customer (stopped ones included) in id order, each with the number of
     * requests in progress.
     */
    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> manage(AuthUser auth, long customerId, PageQuery page) {
        Admin admin = adminAccess.require(auth, customerId);
        Map<Long, Long> active = requestStats.activeCountsByProject(admin.customerId());
        List<Project> all = projects.findByCustomerIdOrderByIdAsc(admin.customerId());
        Set<Long> withHistory = Set.copyOf(projects.findIdsWithHistory(admin.customerId()));
        boolean last = all.size() <= 1;
        return PageResponse.slice(all, page, rows -> rows.stream()
                .map(p -> ProjectResponse.of(p, active.getOrDefault(p.getId(), 0L),
                        !last && !withHistory.contains(p.getId())))
                .toList());
    }

    public ProjectResponse create(AuthUser auth, long customerId, ProjectBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        ProjectBody b = body == null ? new ProjectBody(null, null, null, null) : body;
        String name = name(b.name());
        User lead = lead(admin, b.leadUserId());
        Set<Long> approvers = approvers(admin, b.approverIds());
        Instant now = clock.instant();
        Project project = new Project(admin.customerId(), name, admin.userId(), now);
        project.assignLead(lead.getId());
        project.replaceApprovers(approvers);
        if (Boolean.FALSE.equals(b.active())) {
            project.changeActive(false, now);
        }
        project = projects.save(project);
        audit.record(admin.userId(), admin.customerId(), "프로젝트 생성", name,
                staffing(project.getLeadUserId(), project.usersWithRole(ProjectRole.APPROVER))
                        + (project.isActive() ? "" : " / 중지"));
        return ProjectResponse.of(project);
    }

    public ProjectResponse update(AuthUser auth, long projectId, ProjectBody body) {
        Project project = projects.findById(projectId).orElseThrow(BusinessException::notFound);
        Admin admin = adminAccess.require(auth, project.getCustomerId());
        ProjectBody b = body == null ? new ProjectBody(null, null, null, null) : body;
        Instant now = clock.instant();
        String nameBefore = project.getName();
        Long leadBefore = project.getLeadUserId();
        List<Long> approversBefore = project.usersWithRole(ProjectRole.APPROVER);
        boolean activeBefore = project.isActive();

        String name = b.name() != null ? name(b.name()) : nameBefore;
        User lead = b.leadUserId() != null && !b.leadUserId().equals(leadBefore) ? lead(admin, b.leadUserId()) : null;
        if (lead != null && project.rolesOf(lead.getId()).contains(ProjectRole.REQUESTER)) {
            throw BusinessException.validation("leadUserId", ProjectRoleRules.LEAD_IS_REQUESTER);
        }
        Set<Long> approvers = b.approverIds() != null ? approvers(admin, b.approverIds()) : null;
        if (Boolean.FALSE.equals(b.active()) && activeBefore) {
            long inProgress = requests.visible(userService.actorOf(admin.user()), List.of(project)).stream()
                    .map(s -> s.request().getStatus())
                    .filter(st -> st != RequestStatus.DRAFT && !st.isFinal())
                    .count();
            if (inProgress > 0) {
                throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "진행 중인 요청이 " + inProgress
                        + "건 있어 사용 중지할 수 없습니다. 요청을 완료하거나 담당자와 정리한 뒤 중지하세요");
            }
        }

        if (!name.equals(nameBefore)) {
            project.rename(name, now);
        }
        if (lead != null) {
            project.assignLead(lead.getId());
        }
        if (approvers != null) {
            project.replaceApprovers(approvers);
        }
        if (b.active() != null && b.active() != activeBefore) {
            project.changeActive(b.active(), now);
        }

        List<String> changes = new ArrayList<>();
        if (!name.equals(nameBefore)) {
            changes.add("이름 " + nameBefore + " → " + name);
        }
        List<Long> approversAfter = project.usersWithRole(ProjectRole.APPROVER);
        if (!Objects.equals(leadBefore, project.getLeadUserId()) || !approversBefore.equals(approversAfter)) {
            changes.add(staffing(leadBefore, approversBefore) + " → "
                    + staffing(project.getLeadUserId(), approversAfter));
        }
        if (activeBefore != project.isActive()) {
            changes.add("상태 " + (activeBefore ? "사용" : "중지") + " → " + (project.isActive() ? "사용" : "중지"));
        }
        if (!changes.isEmpty()) {
            projects.flush();
            audit.record(admin.userId(), admin.customerId(), "프로젝트 변경", name, String.join(" / ", changes));
        }
        return ProjectResponse.of(project);
    }

    /**
     * Replaces the project's participation (contract §24): listed users get exactly their roles, other members lose
     * theirs. Every user is checked first ({@link ProjectRoleRules#problem}, newly added users must not be
     * deactivated) and an approval customer keeps at least one active approver; nothing changes when one fails.
     */
    public ProjectResponse replaceMembers(AuthUser auth, long projectId, ProjectMembersBody body) {
        Project project = projects.findById(projectId).orElseThrow(BusinessException::notFound);
        Admin admin = adminAccess.require(auth, project.getCustomerId());
        List<ProjectMembersBody.Item> items = body == null || body.members() == null ? List.of() : body.members();
        Map<Long, Set<ProjectRole>> next = new LinkedHashMap<>();
        Map<Long, User> users = new LinkedHashMap<>();
        for (int i = 0; i < items.size(); i++) {
            ProjectMembersBody.Item item = items.get(i);
            if (item == null || item.userId() == null) {
                throw BusinessException.validation("members." + i + ".userId", "사용자를 선택하세요");
            }
            if (next.containsKey(item.userId())) {
                throw BusinessException.validation("members." + i + ".userId", "같은 사용자를 두 번 보냈습니다");
            }
            User user = adminAccess.requireCustomerUser(admin, item.userId());
            Set<ProjectRole> roles = EnumSet.noneOf(ProjectRole.class);
            if (item.roles() != null) {
                item.roles().stream().filter(Objects::nonNull).forEach(roles::add);
            }
            if (!roles.isEmpty() && project.rolesOf(user.getId()).isEmpty() && !user.isActive() && !user.isPending()) {
                throw BusinessException.validation("members." + i + ".userId", "비활성 사용자는 프로젝트에 추가할 수 없습니다");
            }
            next.put(user.getId(), roles);
            users.put(user.getId(), user);
        }
        for (Long current : project.roleMap().keySet()) {
            if (!next.containsKey(current)) {
                next.put(current, EnumSet.noneOf(ProjectRole.class));
            }
        }

        List<Request> inProject = requests.visible(userService.actorOf(admin.user()), List.of(project)).stream()
                .map(ScopedRequest::request).toList();
        Map<Long, Set<ProjectRole>> changes = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<ProjectRole>> e : next.entrySet()) {
            long userId = e.getKey();
            Set<ProjectRole> before = project.rolesOf(userId);
            if (before.equals(e.getValue())) {
                continue;
            }
            boolean assigned = inProject.stream().anyMatch(r -> REVIEW_IN_PROGRESS.contains(r.getStatus())
                    && r.getReviewerIds().contains(userId));
            boolean requesting = inProject.stream().anyMatch(r -> r.getStatus() != RequestStatus.DRAFT
                    && !r.getStatus().isFinal() && Long.valueOf(userId).equals(r.getRequesterId()));
            // the last approver is judged on the whole result below, not per user
            ProjectRoleRules.Facts facts = new ProjectRoleRules.Facts(project.getName(),
                    admin.customer().isApprovalEnabled(), Long.valueOf(userId).equals(project.getLeadUserId()),
                    assigned, requesting, false);
            String problem = ProjectRoleRules.problem(facts, before, e.getValue());
            if (problem != null) {
                throw new BusinessException(ErrorCode.VALIDATION_FAILED, problem);
            }
            changes.put(userId, e.getValue());
        }
        if (admin.customer().isApprovalEnabled()) {
            Map<Long, User> approverUsers = userService.byIds(next.entrySet().stream()
                    .filter(e -> e.getValue().contains(ProjectRole.APPROVER)).map(Map.Entry::getKey).toList());
            boolean anyActive = approverUsers.values().stream().anyMatch(u -> u.isActive() && !u.isPending());
            if (!anyActive) {
                throw BusinessException.validation("members", "승인자를 한 명 이상 지정하세요");
            }
        }

        if (!changes.isEmpty()) {
            Map<Long, User> named = userService.byIds(changes.keySet());
            List<String> parts = new ArrayList<>();
            changes.forEach((userId, after) -> {
                User u = users.containsKey(userId) ? users.get(userId) : named.get(userId);
                parts.add((u == null ? "-" : u.getName()) + ": " + ProjectRoleRules.label(project.rolesOf(userId))
                        + " → " + ProjectRoleRules.label(after));
                project.replaceRoles(userId, after);
            });
            projects.flush();
            audit.record(admin.userId(), admin.customerId(), "프로젝트 구성원 변경", project.getName(),
                    String.join(" / ", parts));
        }
        return ProjectResponse.of(project);
    }

    /**
     * Deletes a project without history (contract §24): never the customer's last project, never one with requests,
     * notices or variables (those are kept by stopping the project).
     */
    public void delete(AuthUser auth, long projectId) {
        Project project = projects.findById(projectId).orElseThrow(BusinessException::notFound);
        Admin admin = adminAccess.require(auth, project.getCustomerId());
        if (projects.findByCustomerIdOrderByIdAsc(admin.customerId()).size() <= 1) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, "고객사의 마지막 프로젝트는 삭제할 수 없습니다");
        }
        if (projects.findIdsWithHistory(admin.customerId()).contains(project.getId())) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT,
                    "요청·공지·변수 이력이 있는 프로젝트는 삭제할 수 없습니다. 사용 중지로 보존하세요");
        }
        String name = project.getName();
        projects.delete(project);
        projects.flush();
        audit.record(admin.userId(), admin.customerId(), "프로젝트 삭제", name, null);
    }

    // ------------------------------------------------------------------ operator initial setup (contract §12)

    /** Result of an operator change of a project's Alimtalk templates ({@code changed} false = nothing to do). */
    public record TemplateChange(Project project, boolean changed, String before, String after) {
    }

    /**
     * Initial project of the operator's setup (actions.md §2.14 {@code seedProject}): the lead reviewer is optional
     * (an active user of the customer, who gets the reviewer role). The caller checks the operator, audits and logs.
     */
    public Project createForSetup(Customer customer, String rawName, Long leadUserId, long operatorId) {
        String name = name(rawName);
        User lead = null;
        if (leadUserId != null) {
            lead = userService.find(leadUserId).orElse(null);
            if (lead == null || !customer.getId().equals(lead.getCustomerId()) || !lead.isActive()
                    || lead.isPending()) {
                throw BusinessException.validation("leadUserId", "같은 고객사의 활성 사용자만 지정할 수 있습니다");
            }
        }
        Project project = new Project(customer.getId(), name, operatorId, clock.instant());
        if (lead != null) {
            project.assignLead(lead.getId());
        }
        return projects.save(project);
    }

    /** Replaces the project's Alimtalk templates after {@link ProjectTemplateRules#templates} validation. */
    public TemplateChange replaceTemplates(long projectId, List<ProjectTemplateRules.TemplateInput> input) {
        Project project = projects.findById(projectId).orElseThrow(BusinessException::notFound);
        List<ProjectTemplate> next = ProjectTemplateRules.templates(input);
        List<ProjectTemplate> before = project.getTemplates();
        if (before.equals(next)) {
            return new TemplateChange(project, false, null, null);
        }
        project.replaceTemplates(next, clock.instant());
        projects.flush();
        return new TemplateChange(project, true, ProjectTemplateRules.templateLabel(before),
                ProjectTemplateRules.templateLabel(next));
    }

    // ------------------------------------------------------------------ helpers

    private static String name(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation("name", "프로젝트 이름을(를) 입력하세요");
        }
        if (v.length() > NAME_MAX) {
            throw BusinessException.validation("name", "프로젝트 이름은 최대 100자입니다");
        }
        return v;
    }

    private User lead(Admin admin, Long leadUserId) {
        if (leadUserId == null) {
            throw BusinessException.validation("leadUserId", "대표 검수자을(를) 입력하세요");
        }
        return activeUser(admin, leadUserId, "leadUserId");
    }

    /**
     * Distinct active users of the customer. Approval customers need at least one; other customers none
     * (an empty list is accepted).
     */
    private Set<Long> approvers(Admin admin, List<Long> ids) {
        Set<Long> distinct = new LinkedHashSet<>(ids == null ? List.of()
                : ids.stream().filter(Objects::nonNull).toList());
        if (!admin.customer().isApprovalEnabled()) {
            if (!distinct.isEmpty()) {
                throw BusinessException.validation("approverIds", ProjectRoleRules.APPROVAL_NOT_USED);
            }
            return distinct;
        }
        if (distinct.isEmpty()) {
            throw BusinessException.validation("approverIds", "승인자를 한 명 이상 지정하세요");
        }
        distinct.forEach(id -> activeUser(admin, id, "approverIds"));
        return distinct;
    }

    private User activeUser(Admin admin, long userId, String field) {
        User user = userService.find(userId).orElse(null);
        if (user == null || !admin.customer().getId().equals(user.getCustomerId()) || !user.isActive()
                || user.isPending()) {
            throw BusinessException.validation(field, "같은 고객사의 활성 사용자만 지정할 수 있습니다");
        }
        return user;
    }

    /** {@code 대표 {이름}, 승인자 {이름들}} (audit wording; {@code 없음} when empty). */
    private String staffing(Long leadId, List<Long> approverIds) {
        List<Long> ids = new ArrayList<>(approverIds);
        if (leadId != null) {
            ids.add(leadId);
        }
        Map<Long, String> names = userService.byIds(ids).values().stream()
                .collect(Collectors.toMap(User::getId, User::getName));
        String lead = leadId == null ? "없음" : names.getOrDefault(leadId, "-");
        String approvers = approverIds.isEmpty() ? "없음"
                : approverIds.stream().map(id -> names.getOrDefault(id, "-")).collect(Collectors.joining(", "));
        return "대표 " + lead + ", 승인자 " + approvers;
    }
}
