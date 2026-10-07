package com.txtms.domain.notice.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
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
import com.txtms.global.security.AuthUser;

/**
 * Notices visible to a user within one customer (withdrawn excluded): customer-wide notices for its own users and
 * admins, project notices for project members and admins. Other customers' notices are never exposed.
 */
@Service
@Transactional(readOnly = true)
public class NoticeService {

    private final NoticeRepository notices;
    private final NoticeLogRepository logs;
    private final ProjectAccess projectAccess;
    private final UserService userService;

    public NoticeService(NoticeRepository notices, NoticeLogRepository logs, ProjectAccess projectAccess,
            UserService userService) {
        this.notices = notices;
        this.logs = logs;
        this.projectAccess = projectAccess;
        this.userService = userService;
    }

    public List<NoticeResponse> list(AuthUser auth, long customerId) {
        User user = userService.require(auth.userId());
        Customer customer = projectAccess.requireAccessibleCustomer(user, customerId);
        List<Notice> visible = visible(user, customer);
        Map<Long, List<NoticeLog>> logsByNotice = visible.isEmpty() ? Map.of()
                : logs.findByNoticeIdInOrderByAtAscIdAsc(visible.stream().map(Notice::getId).toList()).stream()
                        .collect(Collectors.groupingBy(NoticeLog::getNoticeId));
        return visible.stream().map(n -> new NoticeResponse(n.getId(), n.getScope(), n.getCustomerId(),
                n.getProjectId(), n.getTitle(), n.getBody(), n.getAuthorId(), n.getCreatedAt(), n.isEdited(),
                n.isWithdrawn(),
                logsByNotice.getOrDefault(n.getId(), List.of()).stream()
                        .map(l -> new NoticeResponse.Log(l.getAt(), l.getActorId(), l.getAction(),
                                l.getPreviousTitle(), l.getPreviousBody()))
                        .toList()))
                .toList();
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
}
