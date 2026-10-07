package com.txtms.domain.ops.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.dto.ContentTypeResponse;
import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.ops.dto.OpsDtos.OpsInvitation;
import com.txtms.domain.ops.dto.OpsDtos.SetupProjectBody;
import com.txtms.domain.ops.dto.OpsDtos.TemplateBody;
import com.txtms.domain.project.dto.ProjectResponse;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.project.service.ProjectAdminService;
import com.txtms.domain.project.service.ProjectAdminService.SendingChange;
import com.txtms.domain.project.service.ProjectSendingRules;
import com.txtms.domain.user.dto.MemberBodies.SetupInvitationBody;
import com.txtms.domain.user.dto.MemberResponse;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.MemberAdminService;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.security.AuthUser;

/**
 * Initial setup of a customer by the operator (actions.md §2.14 {@code seedProject}/{@code seedUser}, screens-b §16)
 * and the operator-managed project sending information (Alimtalk templates, SMS sender numbers) and content types
 * (§17). Writes need an active customer; every step is audited and written to the setup log.
 */
@Service
@Transactional
public class OpsSetupService {

    private final OperatorAccess operators;
    private final OpsCustomerService opsCustomers;
    private final ProjectAdminService projectAdmin;
    private final ProjectAccess projectAccess;
    private final MemberAdminService members;
    private final UserService users;
    private final ContentTypeService contentTypes;
    private final SetupLogService setupLogs;
    private final AuditLogService audit;

    public OpsSetupService(OperatorAccess operators, OpsCustomerService opsCustomers,
            ProjectAdminService projectAdmin, ProjectAccess projectAccess, MemberAdminService members,
            UserService users,
            ContentTypeService contentTypes, SetupLogService setupLogs, AuditLogService audit) {
        this.operators = operators;
        this.opsCustomers = opsCustomers;
        this.projectAdmin = projectAdmin;
        this.projectAccess = projectAccess;
        this.members = members;
        this.users = users;
        this.contentTypes = contentTypes;
        this.setupLogs = setupLogs;
        this.audit = audit;
    }

    /** Initial project; audited {@code 프로젝트 생성} ({@code 초기 설정}), setup log {@code 초기 프로젝트 생성}. */
    public ProjectResponse createProject(AuthUser auth, long customerId, SetupProjectBody body) {
        User operator = operators.require(auth);
        Customer customer = opsCustomers.requireActive(customerId);
        SetupProjectBody b = body == null ? new SetupProjectBody(null, null) : body;
        Project project = projectAdmin.createForSetup(customer, b.name(), b.leadUserId(), operator.getId());
        String lead = project.getLeadUserId() == null ? null
                : users.find(project.getLeadUserId()).map(User::getName).orElse(null);
        audit.record(operator.getId(), customer.getId(), "프로젝트 생성", project.getName(),
                "초기 설정, 대표 " + (lead == null ? "없음" : lead));
        setupLogs.record(customer.getId(), operator.getId(), "초기 프로젝트 생성", project.getName(),
                lead == null ? "대표 검수자 미지정" : "대표 검수자 " + lead);
        return ProjectResponse.of(project);
    }

    /** First admin or initial work user; setup log {@code 초대 링크 생성} (audit {@code 사용자 초대} in the member service). */
    public OpsInvitation invite(AuthUser auth, long customerId, SetupInvitationBody body) {
        User operator = operators.require(auth);
        Customer customer = opsCustomers.requireActive(customerId);
        MemberAdminService.SetupInvitation invitation = members.inviteForSetup(customer, operator.getId(), body);
        MemberResponse member = invitation.member();
        setupLogs.record(customer.getId(), operator.getId(), "초대 링크 생성", member.user().email(),
                member.admin() ? "고객사 관리자" : "업무 사용자");
        return new OpsInvitation(member, invitation.mailId());
    }

    /** Members of a customer (pending and inactive users included), also for an inactive customer. */
    @Transactional(readOnly = true)
    public List<MemberResponse> members(AuthUser auth, long customerId) {
        operators.require(auth);
        return members.membersOf(opsCustomers.requireExisting(customerId));
    }

    /**
     * Projects of a customer in id order (stopped projects and inactive customers included). Project metadata only
     * (templates, senders, roles); no request or content data and no {@code activeRequestCount}.
     */
    @Transactional(readOnly = true)
    public List<ProjectResponse> projects(AuthUser auth, long customerId) {
        operators.require(auth);
        Customer customer = opsCustomers.requireExisting(customerId);
        return projectAccess.byCustomer(customer.getId()).stream().map(ProjectResponse::of).toList();
    }

    /** Alimtalk templates of a project; audited {@code 프로젝트 발신 정보 변경}, setup log {@code 템플릿 등록}. */
    public ProjectResponse replaceTemplates(AuthUser auth, long projectId, List<TemplateBody> body) {
        User operator = operators.require(auth);
        Project project = projectOfActiveCustomer(projectId);
        List<ProjectSendingRules.TemplateInput> input = body == null ? null
                : body.stream().map(t -> t == null ? null : new ProjectSendingRules.TemplateInput(t.code(), t.name()))
                        .toList();
        SendingChange change = projectAdmin.replaceTemplates(project.getId(), input);
        if (change.changed()) {
            audit.record(operator.getId(), project.getCustomerId(), "프로젝트 발신 정보 변경", project.getName(),
                    "알림톡 템플릿 " + change.before() + " → " + change.after());
            setupLogs.record(project.getCustomerId(), operator.getId(), "템플릿 등록", project.getName(),
                    "템플릿 " + change.project().getTemplates().size() + "개");
        }
        return ProjectResponse.of(change.project());
    }

    /** SMS sender numbers of a project; audited {@code 프로젝트 발신 정보 변경}, setup log {@code 발신번호 등록}. */
    public ProjectResponse replaceSenders(AuthUser auth, long projectId, List<String> body) {
        User operator = operators.require(auth);
        Project project = projectOfActiveCustomer(projectId);
        SendingChange change = projectAdmin.replaceSenders(project.getId(), body);
        if (change.changed()) {
            audit.record(operator.getId(), project.getCustomerId(), "프로젝트 발신 정보 변경", project.getName(),
                    "발신번호 " + change.before() + " → " + change.after());
            setupLogs.record(project.getCustomerId(), operator.getId(), "발신번호 등록", project.getName(),
                    "발신번호 " + change.project().getSenders().size() + "개");
        }
        return ProjectResponse.of(change.project());
    }

    private Project projectOfActiveCustomer(long projectId) {
        Project project = projectAccess.requireProject(projectId);
        opsCustomers.requireActive(project.getCustomerId());
        return project;
    }

    // ------------------------------------------------------------------ content types

    @Transactional(readOnly = true)
    public List<ContentTypeResponse> contentTypes(AuthUser auth) {
        operators.require(auth);
        return contentTypes.contentTypes();
    }

    /** Switches a content type; unknown type {@code NOT_FOUND}, missing {@code active} {@code VALIDATION_FAILED}. */
    public ContentTypeResponse setContentTypeActive(AuthUser auth, String type, Boolean active) {
        User operator = operators.require(auth);
        ContentType t;
        try {
            t = ContentType.valueOf(type);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw BusinessException.notFound();
        }
        if (active == null) {
            throw BusinessException.validation("active", "사용 여부를 선택하세요");
        }
        return contentTypes.setActive(t, active, operator.getId());
    }
}
