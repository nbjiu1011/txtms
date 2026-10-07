package com.txtms.domain.request.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.service.ContentTypeService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.dto.response.SampleRequestSummary;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestInfo;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.request.validation.PayloadNormalizer;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.common.Kst;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.storage.FileStorage;

import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Sample (demo) requests of the operator's initial setup (actions.md §2.14 {@code seedSample}/{@code seedClear}/
 * {@code reset}) and the physical removal of requests with every child row. The caller checks the operator and the
 * sample customer; this service never decides which customers may be touched.
 */
@Service
@Transactional
public class SampleRequestService {

    private static final Logger log = LoggerFactory.getLogger(SampleRequestService.class);

    static final int SAMPLE_DUE_DAYS = 7;

    private final RequestRepository requests;
    private final ContentRepository contents;
    private final RequestIdGenerator idGenerator;
    private final RequestWriteSupport support;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final ContentTypeService contentTypes;
    private final FileStorage storage;
    private final NamedParameterJdbcTemplate named;
    private final JsonMapper json;

    public SampleRequestService(RequestRepository requests, ContentRepository contents,
            RequestIdGenerator idGenerator, RequestWriteSupport support, ProjectAccess projectAccess,
            UserService userService, ContentTypeService contentTypes, FileStorage storage, JdbcTemplate jdbc,
            JsonMapper json) {
        this.requests = requests;
        this.contents = contents;
        this.idGenerator = idGenerator;
        this.support = support;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.contentTypes = contentTypes;
        this.storage = storage;
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.json = json;
    }

    // ------------------------------------------------------------------ create / list

    /**
     * One draft sample request ({@code demo}) in an active project of the customer: title {@code [샘플] {유형} 작성
     * 연습}, information filled, hope due date in 7 days (KST), content C1 with a sample body for Alimtalk and SMS.
     * The requester is the project's first active requester, else any active requester of the customer's active
     * projects, else the operator (prototype wording "요청자 역할 사용자가 없으면 운영 담당자 이름으로 기록").
     * History {@code 요청 작성} + {@code 샘플 요청 생성}.
     */
    public SampleRequestSummary create(Customer customer, Long projectId, ContentType type, long operatorId) {
        List<Project> active = projectAccess.byCustomer(customer.getId()).stream().filter(Project::isActive).toList();
        if (active.isEmpty()) {
            throw new BusinessException(com.txtms.global.exception.ErrorCode.REQUEST_STATE_CONFLICT,
                    "사용 중인 프로젝트가 없습니다");
        }
        if (projectId == null) {
            throw BusinessException.validation("projectId", "프로젝트를 선택하세요");
        }
        Project project = projectAccess.byCustomer(customer.getId()).stream()
                .filter(p -> p.getId().equals(projectId)).findFirst().orElseThrow(BusinessException::notFound);
        if (!project.isActive()) {
            throw BusinessException.validation("projectId", "사용 중인 프로젝트만 선택할 수 있습니다");
        }
        if (type == null || !contentTypes.isActive(type)) {
            throw BusinessException.validation("type", "사용 중인 유형만 선택할 수 있습니다");
        }
        long requesterId = requesterOf(project, active, operatorId);
        Instant now = support.now();
        Request r = new Request(idGenerator.next(now), project.getId(), type, requesterId, now);
        LocalDate due = Kst.dateOf(now).plusDays(SAMPLE_DUE_DAYS);
        r.updateInfo(new RequestInfo("[샘플] " + ContentTypeService.label(type) + " 작성 연습", due, "화면 사용 연습",
                "샘플 대상 고객", "도입 교육용 샘플", null, Urgency.NORMAL), now);
        r.markDemo();
        r = requests.save(r);
        ObjectNode payload = PayloadNormalizer.blank(type);
        if (type == ContentType.ALIMTALK) {
            payload.put("body", "#{customer_name}님, 샘플 안내 문안입니다. 내용을 바꿔 보세요.");
        } else if (type == ContentType.SMS) {
            payload.put("body", "[" + customer.getName() + "] 샘플 안내 문안입니다.");
            payload.put("sender", project.getSenders().isEmpty() ? "" : project.getSenders().getFirst());
        }
        contents.save(new Content(r.getId(), "C1", "콘텐츠 1", json.writeValueAsString(payload), 1, now));
        support.log(r, requesterId, "요청 작성", null, null, null);
        support.log(r, operatorId, "샘플 요청 생성", "초기 설정에서 생성한 샘플", null, null);
        requests.flush();
        return summary(r);
    }

    private long requesterOf(Project project, List<Project> activeProjects, long operatorId) {
        List<Project> order = new ArrayList<>();
        order.add(project);
        activeProjects.stream().filter(p -> !p.getId().equals(project.getId())).forEach(order::add);
        for (Project p : order) {
            List<Long> candidates = p.usersWithRole(ProjectRole.REQUESTER);
            Map<Long, User> users = userService.byIds(candidates);
            for (Long id : candidates) {
                User u = users.get(id);
                if (u != null && userService.canUseAccount(u)) {
                    return id;
                }
            }
        }
        return operatorId;
    }

    /** Sample requests of the customer, newest first. */
    @Transactional(readOnly = true)
    public List<SampleRequestSummary> samplesOf(long customerId) {
        List<Long> projectIds = projectAccess.byCustomer(customerId).stream().map(Project::getId).toList();
        if (projectIds.isEmpty()) {
            return List.of();
        }
        return requests.findByProjectIdIn(projectIds).stream().filter(Request::isDemo)
                .sorted(Comparator.comparing(Request::getCreatedAt).thenComparing(Request::getId).reversed())
                .map(SampleRequestService::summary).toList();
    }

    private static SampleRequestSummary summary(Request r) {
        return new SampleRequestSummary(r.getId(), r.getProjectId(), r.getType(), r.getTitle(), r.getStatus(),
                r.getCreatedAt());
    }

    // ------------------------------------------------------------------ removal

    /** Ids of the requests in the customers' projects ({@code demoOnly}: sample requests only). */
    @Transactional(readOnly = true)
    public List<String> requestIdsOf(Collection<Long> customerIds, boolean demoOnly) {
        if (customerIds.isEmpty()) {
            return List.of();
        }
        return named.queryForList("SELECT r.id FROM requests r JOIN projects p ON p.id = r.project_id "
                + "WHERE p.customer_id IN (:customers)" + (demoOnly ? " AND r.demo = TRUE" : "") + " ORDER BY r.id",
                new MapSqlParameterSource("customers", customerIds), String.class);
    }

    /** Of the given request ids, those that exist outside the customers' projects. */
    @Transactional(readOnly = true)
    public List<String> existingOutside(Collection<String> requestIds, Collection<Long> customerIds) {
        if (requestIds.isEmpty()) {
            return List.of();
        }
        MapSqlParameterSource params = new MapSqlParameterSource("ids", requestIds)
                .addValue("customers", customerIds.isEmpty() ? List.of(-1L) : customerIds);
        return named.queryForList("SELECT r.id FROM requests r JOIN projects p ON p.id = r.project_id "
                + "WHERE r.id IN (:ids) AND p.customer_id NOT IN (:customers)", params, String.class);
    }

    /**
     * Physically deletes the requests and every child row (contents, versions, attachments, images, history,
     * opinions, questions, assignment changes, reminders, correction suggestions, completion bundles, the
     * notifications about them). Parent links pointing at removed requests are cleared. Stored objects that no
     * remaining row references are deleted after the commit (clones and follow-ups share objects, so shared ones
     * stay). Returns the number of removed requests.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int purge(Collection<String> requestIds) {
        if (requestIds.isEmpty()) {
            return 0;
        }
        requests.flush();
        MapSqlParameterSource ids = new MapSqlParameterSource("ids", new ArrayList<>(new LinkedHashSet<>(requestIds)));
        List<String> locked = named.queryForList("SELECT id FROM requests WHERE id IN (:ids) FOR UPDATE", ids,
                String.class);
        if (locked.isEmpty()) {
            return 0;
        }
        ids = new MapSqlParameterSource("ids", locked);
        String contentIds = "SELECT id FROM contents WHERE request_id IN (:ids)";
        String fileIds = "SELECT id FROM content_files WHERE content_id IN (" + contentIds + ")";
        Set<String> keys = new HashSet<>(named.queryForList("SELECT storage_key FROM content_file_versions "
                + "WHERE storage_key IS NOT NULL AND file_id IN (" + fileIds + ")", ids, String.class));
        keys.addAll(named.queryForList("SELECT storage_key FROM content_images WHERE request_id IN (:ids)", ids,
                String.class));

        named.update("UPDATE requests SET parent_request_id = NULL, parent_content_key = NULL "
                + "WHERE parent_request_id IN (:ids)", ids);
        named.update("UPDATE contents SET parent_request_id = NULL, parent_content_key = NULL "
                + "WHERE parent_request_id IN (:ids)", ids);
        for (String table : List.of("notifications", "request_reminders", "request_assignment_changes",
                "request_opinions", "request_asks", "request_history", "correction_suggestions",
                "completion_bundle_items", "completion_bundles", "content_images")) {
            named.update("DELETE FROM " + table + " WHERE request_id IN (:ids)", ids);
        }
        named.update("DELETE FROM content_file_versions WHERE file_id IN (SELECT id FROM (" + fileIds + ") f)", ids);
        named.update("DELETE FROM content_files WHERE content_id IN (SELECT id FROM (" + contentIds + ") c)", ids);
        named.update("DELETE FROM content_versions WHERE content_id IN (SELECT id FROM (" + contentIds + ") c)", ids);
        named.update("DELETE FROM contents WHERE request_id IN (:ids)", ids);
        named.update("DELETE FROM request_reviewers WHERE request_id IN (:ids)", ids);
        int removed = named.update("DELETE FROM requests WHERE id IN (:ids)", ids);

        if (!keys.isEmpty()) {
            MapSqlParameterSource k = new MapSqlParameterSource("keys", keys);
            Set<String> stillUsed = new HashSet<>(named.queryForList("SELECT storage_key FROM content_file_versions "
                    + "WHERE storage_key IN (:keys)", k, String.class));
            stillUsed.addAll(named.queryForList("SELECT storage_key FROM content_images WHERE storage_key IN (:keys)",
                    k, String.class));
            keys.removeAll(stillUsed);
            deleteAfterCommit(keys);
        }
        return removed;
    }

    private void deleteAfterCommit(Set<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        List<String> toDelete = List.copyOf(keys);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                toDelete.forEach(storage::delete);
                log.info("Removed {} stored objects of deleted sample requests", toDelete.size());
            }
        });
    }
}
