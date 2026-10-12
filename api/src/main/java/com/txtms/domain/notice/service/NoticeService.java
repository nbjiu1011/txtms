package com.txtms.domain.notice.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerAdminAccess;
import com.txtms.domain.customer.service.CustomerAdminAccess.Admin;
import com.txtms.domain.notice.dto.NoticeBody;
import com.txtms.domain.notice.dto.NoticeResponse;
import com.txtms.domain.notice.dto.NoticeSummary;
import com.txtms.domain.notice.entity.Notice;
import com.txtms.domain.notice.entity.NoticeLog;
import com.txtms.domain.notice.entity.NoticeScope;
import com.txtms.domain.notice.repository.NoticeLogRepository;
import com.txtms.domain.notice.repository.NoticeRepository;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.common.RichText;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

/**
 * Notices. Reading: notices visible to a user within one customer (withdrawn excluded): customer-wide notices for
 * its own users and admins, project notices for project members and admins. Other customers' notices are never
 * exposed. Management (customer admins of the notice's customer): list with withdrawn ones, post, edit (the full
 * previous snapshot and the actor are logged as {@code 수정}), withdraw ({@code 철회}). Every write is audited.
 */
@Service
@Transactional(readOnly = true)
public class NoticeService {

    static final int TITLE_MAX = 200;
    /** Server cap of the (non-paged) notice lists, newest first (contract §0.1 small lists). */
    /** Upper bound of a rich body including inline images (base64), about 5 MB. */
    static final int HTML_MAX = 5_000_000;
    static final String WITHDRAWN = "철회된 공지는 수정하거나 다시 철회할 수 없습니다";

    private final NoticeRepository notices;
    private final NoticeLogRepository logs;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final CustomerAdminAccess adminAccess;
    private final AuditLogService audit;
    private final Clock clock;
    private final int bodyMax;

    public NoticeService(NoticeRepository notices, NoticeLogRepository logs, ProjectAccess projectAccess,
            UserService userService, CustomerAdminAccess adminAccess, AuditLogService audit, Clock clock,
            AppProperties properties) {
        this.notices = notices;
        this.logs = logs;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.adminAccess = adminAccess;
        this.audit = audit;
        this.clock = clock;
        this.bodyMax = properties.content().maxTextLength();
    }

    // ------------------------------------------------------------------ reading

    public PageResponse<NoticeResponse> list(AuthUser auth, long customerId, PageQuery page) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        return PageResponse.slice(visible(user, customer), page, this::responses);
    }

    /** Newest visible notices of the customer, for dashboards. */
    public List<NoticeSummary> latest(User user, Customer customer, int limit) {
        return visible(user, customer).stream().limit(limit)
                .map(n -> new NoticeSummary(n.getId(), n.getScope(), n.getCustomerId(), n.getProjectId(),
                        n.getTitle(), n.getCreatedAt()))
                .toList();
    }

    private List<Notice> visible(User user, Customer customer) {
        boolean admin = user.isAdminOf(customer.getId());
        boolean ownCustomer = customer.getId().equals(user.getCustomerId());
        Map<Long, Project> projects = projectAccess.byCustomer(customer.getId()).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        Set<Long> memberProjects = projects.values().stream()
                .filter(p -> !p.rolesOf(user.getId()).isEmpty())
                .map(Project::getId)
                .collect(Collectors.toSet());
        return notices.findByCustomerIdAndWithdrawnFalseOrderByCreatedAtDescIdDesc(customer.getId()).stream()
                .filter(n -> n.getScope() == NoticeScope.CUSTOMER
                        ? ownCustomer || admin
                        : projects.containsKey(n.getProjectId()) && (admin || memberProjects.contains(n.getProjectId())))
                .toList();
    }

    // ------------------------------------------------------------------ management

    /** Every notice of the customer, withdrawn ones included, newest first. */
    public PageResponse<NoticeResponse> manage(AuthUser auth, long customerId, PageQuery page) {
        Admin admin = adminAccess.require(auth, customerId);
        return PageResponse.batch(notices.findByCustomerIdOrderByCreatedAtDescIdDesc(admin.customerId(),
                PageRequest.of(page.page(), page.size())), this::responses);
    }

    @Transactional
    public NoticeResponse create(AuthUser auth, long customerId, NoticeBody body) {
        Admin admin = adminAccess.require(auth, customerId);
        NoticeBody b = body == null ? new NoticeBody(null, null, null, null) : body;
        NoticeScope scope = requireScope(b.scope());
        Long projectId = scope == NoticeScope.PROJECT ? requireProject(admin, b.projectId()) : null;
        String title = title(b.title());
        String text = body(b.body());
        Notice notice = notices.save(new Notice(scope, admin.customerId(), projectId, title, text, admin.userId(),
                clock.instant()));
        audit.record(admin.userId(), admin.customerId(), "공지 게시", title, scopeLabel(notice));
        return response(notice, List.of());
    }

    /** Edit: keys left out keep their value. The previous scope, project, title and body are logged with the actor. */
    @Transactional
    public NoticeResponse update(AuthUser auth, long noticeId, NoticeBody body) {
        Notice notice = notices.findById(noticeId).orElseThrow(BusinessException::notFound);
        Admin admin = adminAccess.require(auth, notice.getCustomerId());
        if (notice.isWithdrawn()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, WITHDRAWN);
        }
        NoticeBody b = body == null ? new NoticeBody(null, null, null, null) : body;
        NoticeScope scope = b.scope() != null ? b.scope() : notice.getScope();
        Long projectId = null;
        if (scope == NoticeScope.PROJECT) {
            projectId = requireProject(admin, b.projectId() != null ? b.projectId() : notice.getProjectId());
        }
        String title = b.title() != null ? title(b.title()) : notice.getTitle();
        String text = b.body() != null ? body(b.body()) : notice.getBody();
        Instant now = clock.instant();
        logs.save(new NoticeLog(notice.getId(), now, admin.userId(), "수정", notice.getScope(),
                notice.getProjectId(), notice.getTitle(), notice.getBody()));
        String before = notice.getTitle();
        notice.edit(scope, projectId, title, text, now);
        audit.record(admin.userId(), admin.customerId(), "공지 수정", title,
                before.equals(title) ? scopeLabel(notice) : "제목 " + before + " → " + title);
        return response(notice, logsOf(notice.getId()));
    }

    @Transactional
    public NoticeResponse withdraw(AuthUser auth, long noticeId) {
        Notice notice = notices.findById(noticeId).orElseThrow(BusinessException::notFound);
        Admin admin = adminAccess.require(auth, notice.getCustomerId());
        if (notice.isWithdrawn()) {
            throw new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT, WITHDRAWN);
        }
        Instant now = clock.instant();
        logs.save(new NoticeLog(notice.getId(), now, admin.userId(), "철회", notice.getScope(),
                notice.getProjectId(), notice.getTitle(), notice.getBody()));
        notice.withdraw(now);
        audit.record(admin.userId(), admin.customerId(), "공지 철회", notice.getTitle(), scopeLabel(notice));
        return response(notice, logsOf(notice.getId()));
    }

    // ------------------------------------------------------------------ helpers

    private static NoticeScope requireScope(NoticeScope scope) {
        if (scope == null) {
            throw BusinessException.validation("scope", "공지 범위를 선택하세요");
        }
        return scope;
    }

    /** A project of the administered customer (missing: VALIDATION_FAILED, another customer's: NOT_FOUND). */
    private Long requireProject(Admin admin, Long projectId) {
        if (projectId == null) {
            throw BusinessException.validation("projectId", "프로젝트를 선택하세요");
        }
        Project project = projectAccess.requireProject(projectId);
        if (!project.getCustomerId().equals(admin.customerId())) {
            throw BusinessException.notFound();
        }
        return project.getId();
    }

    private static String title(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) {
            throw BusinessException.validation("title", "제목을(를) 입력하세요");
        }
        if (v.length() > TITLE_MAX) {
            throw BusinessException.validation("title", "제목은 최대 200자입니다");
        }
        return v;
    }

    /**
     * Body of the rich text editor (contract §18): sanitized HTML, judged by its visible text (and images). A body
     * that is not HTML is plain text as before the editor and is kept as written.
     */
    private String body(String raw) {
        String v = raw == null ? "" : raw.strip();
        if (!RichText.isHtml(v)) {
            return plainBody(v);
        }
        RichText.Result rich = RichText.sanitize(v);
        String text = rich.text().strip();
        if (text.isEmpty() && !rich.hasImage()) {
            throw BusinessException.validation("body", "내용을(를) 입력하세요");
        }
        if (text.codePointCount(0, text.length()) > bodyMax) {
            throw BusinessException.validation("body", String.format("내용은 최대 %,d자입니다", bodyMax));
        }
        if (rich.html().length() > HTML_MAX) {
            throw BusinessException.validation("body", "이미지를 포함한 내용이 너무 큽니다. 이미지를 줄여 주세요");
        }
        return rich.html();
    }

    private String plainBody(String v) {
        if (v.isEmpty()) {
            throw BusinessException.validation("body", "내용을(를) 입력하세요");
        }
        if (v.length() > bodyMax) {
            throw BusinessException.validation("body", String.format("내용은 최대 %,d자입니다", bodyMax));
        }
        return v;
    }

    private String scopeLabel(Notice n) {
        if (n.getScope() == NoticeScope.CUSTOMER) {
            return "고객사 전체 공지";
        }
        return "프로젝트 공지 " + projectAccess.requireProject(n.getProjectId()).getName();
    }

    private List<NoticeLog> logsOf(long noticeId) {
        return logs.findByNoticeIdInOrderByAtAscIdAsc(List.of(noticeId));
    }

    private List<NoticeResponse> responses(List<Notice> list) {
        Map<Long, List<NoticeLog>> logsByNotice = list.isEmpty() ? Map.of()
                : logs.findByNoticeIdInOrderByAtAscIdAsc(list.stream().map(Notice::getId).toList()).stream()
                        .collect(Collectors.groupingBy(NoticeLog::getNoticeId));
        return list.stream().map(n -> response(n, logsByNotice.getOrDefault(n.getId(), List.of()))).toList();
    }

    private static NoticeResponse response(Notice n, List<NoticeLog> noticeLogs) {
        return new NoticeResponse(n.getId(), n.getScope(), n.getCustomerId(), n.getProjectId(), n.getTitle(),
                n.getBody(), n.getAuthorId(), n.getCreatedAt(), n.isEdited(), n.isWithdrawn(),
                noticeLogs.stream()
                        .map(l -> new NoticeResponse.Log(l.getAt(), l.getActorId(), l.getAction(),
                                l.getPreviousScope(), l.getPreviousProjectId(), l.getPreviousTitle(),
                                l.getPreviousBody()))
                        .toList());
    }
}
