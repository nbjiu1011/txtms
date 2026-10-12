package com.txtms.domain.variable.service;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.service.ProjectAccess;
import com.txtms.domain.request.service.RequestQueryService;
import com.txtms.domain.request.validation.VariableTokens;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.domain.variable.dto.ProjectVariableLogResponse;
import com.txtms.domain.variable.dto.VariableCreateRequest;
import com.txtms.domain.variable.dto.VariableLogResponse;
import com.txtms.domain.variable.dto.VariableResponse;
import com.txtms.domain.variable.dto.VariableUpdateRequest;
import com.txtms.domain.variable.entity.Variable;
import com.txtms.domain.variable.entity.VariableLog;
import com.txtms.domain.variable.entity.VariableType;
import com.txtms.domain.variable.repository.VariableLogRepository;
import com.txtms.domain.variable.repository.VariableRepository;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.common.PageQuery;
import com.txtms.global.common.PageResponse;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;

import tools.jackson.databind.json.JsonMapper;

/**
 * Project variables. Any project member (or customer admin) may register a variable; editing, deleting and the
 * change logs (per variable or for the whole project) and the listing of deleted variables are for customer admins.
 * A variable is "in use" when the current content of any request of the project
 * contains {@code #{key}} (versions and completion bundles are not considered). Every change bumps the project's
 * {@code variablesRevision} and is logged.
 */
@Service
@Transactional(readOnly = true)
public class VariableService {

    static final int MAX_DESCRIPTION_LENGTH = 200;

    /** Server-side cap for variable lists and the project change log. */
    static final int LIST_LIMIT = 500;

    static final String ADMIN_REQUIRED = "고객사 관리자 권한이 필요합니다";

    private final VariableRepository variables;
    private final VariableLogRepository logs;
    private final ProjectAccess projectAccess;
    private final UserService userService;
    private final RequestQueryService requestQueries;
    private final AuditLogService audit;
    private final JsonMapper json;
    private final Clock clock;

    public VariableService(VariableRepository variables, VariableLogRepository logs, ProjectAccess projectAccess,
            UserService userService, RequestQueryService requestQueries, AuditLogService audit, JsonMapper json,
            Clock clock) {
        this.variables = variables;
        this.logs = logs;
        this.projectAccess = projectAccess;
        this.userService = userService;
        this.requestQueries = requestQueries;
        this.audit = audit;
        this.json = json;
        this.clock = clock;
    }

    /**
     * Variables of the project in registration order. {@code includeDeleted} (customer admins only; other members get
     * FORBIDDEN) adds logically deleted variables, marked {@code deleted: true}.
     */
    public List<VariableResponse> list(AuthUser auth, long projectId, String q, Boolean active,
            boolean includeDeleted) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, projectId);
        if (includeDeleted) {
            requireAdmin(user, project);
        }
        List<Variable> rows = matching(project, q, active, includeDeleted).stream().limit(LIST_LIMIT).toList();
        return responses(project, rows);
    }

    /** 변수 관리 list (customer admins): deleted variables included, registration order, one page. */
    public PageResponse<VariableResponse> manage(AuthUser auth, long projectId, String q, Boolean active,
            PageQuery page) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, projectId);
        requireAdmin(user, project);
        return PageResponse.slice(matching(project, q, active, true), page, rows -> responses(project, rows));
    }

    private List<Variable> matching(Project project, String q, Boolean active, boolean includeDeleted) {
        String needle = q == null || q.isBlank() ? null : q.trim().toLowerCase(Locale.ROOT);
        List<Variable> source = includeDeleted ? variables.findByProjectIdOrderByIdAsc(project.getId())
                : variables.findByProjectIdAndDeletedFalseOrderByIdAsc(project.getId());
        return source.stream()
                .filter(v -> active == null || v.isActive() == active)
                .filter(v -> needle == null || v.getKey().toLowerCase(Locale.ROOT).contains(needle)
                        || v.getDescription() != null && v.getDescription().toLowerCase(Locale.ROOT).contains(needle))
                .toList();
    }

    private List<VariableResponse> responses(Project project, List<Variable> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> payloads = requestQueries.currentPayloadsOfProject(project.getId());
        return rows.stream().map(v -> response(v, inUse(v.getKey(), payloads))).toList();
    }

    /** Active variables of a project: key → current value (submit validation, link resolution). */
    public Map<String, String> activeValues(long projectId) {
        Map<String, String> values = new LinkedHashMap<>();
        variables.findByProjectIdAndActiveTrueAndDeletedFalseOrderByIdAsc(projectId)
                .forEach(v -> values.put(v.getKey(), v.getValue() == null ? "" : v.getValue()));
        return values;
    }

    /** Active, not deleted variables of a project in registration order (completion bundle snapshot). */
    public List<com.txtms.domain.variable.dto.VariableSnapshot> activeSnapshot(long projectId) {
        return variables.findByProjectIdAndActiveTrueAndDeletedFalseOrderByIdAsc(projectId).stream()
                .map(v -> new com.txtms.domain.variable.dto.VariableSnapshot(v.getKey(), v.getType(),
                        v.getValue() == null ? "" : v.getValue()))
                .toList();
    }

    @Transactional
    public VariableResponse create(AuthUser auth, long projectId, VariableCreateRequest body) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireWorkProject(user, projectId);
        String key = body.key() == null ? "" : body.key().trim();
        checkKey(key);
        if (body.type() == null) {
            throw BusinessException.validation("type", "자료형을 선택하세요");
        }
        String description = description(body.description());
        String value = body.value() == null ? "" : body.value();
        checkValue(body.type(), value);
        rejectDuplicate(project.getId(), key, null);

        Instant now = clock.instant();
        Variable v = new Variable(project.getId(), key, description, body.type(), value, user.getId(), now);
        try {
            variables.saveAndFlush(v);
        } catch (DataIntegrityViolationException e) {
            throw duplicate();
        }
        logs.save(new VariableLog(v.getId(), now, user.getId(), "등록", null, snapshot(v)));
        projectAccess.bumpVariablesRevision(project.getId());
        audit.record(user.getId(), project.getCustomerId(), "변수 등록", project.getName() + " #{" + key + "}",
                snapshot(v));
        return response(v, false);
    }

    @Transactional
    public VariableResponse update(AuthUser auth, long id, VariableUpdateRequest body) {
        User user = userService.require(auth.userId());
        Variable v = requireAdminVariable(user, id, false);
        Project project = projectAccess.requireProject(v.getProjectId());
        boolean used = inUse(v.getKey(), requestQueries.currentPayloadsOfProject(project.getId()));

        String key = body.key() == null ? v.getKey() : body.key().trim();
        if (!key.equals(v.getKey())) {
            checkKey(key);
            if (used) {
                throw BusinessException.validation("key", "사용 중인 변수는 키를 변경할 수 없습니다");
            }
            rejectDuplicate(project.getId(), key, v.getId());
        }
        String description = body.description() == null ? v.getDescription() : description(body.description());
        VariableType type = body.type() == null ? v.getType() : body.type();
        String value = body.value() == null ? v.getValue() : body.value();
        checkValue(type, value);
        boolean active = body.active() == null ? v.isActive() : body.active();

        String before = snapshot(v);
        boolean onlyActiveChanged = key.equals(v.getKey()) && Objects.equals(type, v.getType())
                && Objects.equals(value, v.getValue()) && active != v.isActive();
        boolean changed = !key.equals(v.getKey()) || !Objects.equals(description, v.getDescription())
                || type != v.getType() || !Objects.equals(value, v.getValue()) || active != v.isActive();
        if (!changed) {
            return response(v, used);
        }
        Instant now = clock.instant();
        v.change(key, description, type, value, active, now);
        try {
            variables.saveAndFlush(v);
        } catch (DataIntegrityViolationException e) {
            throw duplicate();
        }
        String action = onlyActiveChanged ? (active ? "사용" : "사용 중지") : "변경";
        logs.save(new VariableLog(v.getId(), now, user.getId(), action, before, snapshot(v)));
        projectAccess.bumpVariablesRevision(project.getId());
        audit.record(user.getId(), project.getCustomerId(), "변수 변경", project.getName() + " #{" + key + "}",
                before + " → " + snapshot(v));
        return response(v, used && key.equals(v.getKey()));
    }

    @Transactional
    public void delete(AuthUser auth, long id) {
        User user = userService.require(auth.userId());
        Variable v = requireAdminVariable(user, id, false);
        Project project = projectAccess.requireProject(v.getProjectId());
        if (inUse(v.getKey(), requestQueries.currentPayloadsOfProject(project.getId()))) {
            throw new BusinessException(ErrorCode.VALIDATION_FAILED, "사용 중인 변수는 삭제할 수 없습니다");
        }
        String before = snapshot(v);
        Instant now = clock.instant();
        v.delete(now);
        logs.save(new VariableLog(v.getId(), now, user.getId(), "삭제 (이력 보존)", before, snapshot(v)));
        projectAccess.bumpVariablesRevision(project.getId());
        audit.record(user.getId(), project.getCustomerId(), "변수 삭제", project.getName() + " #{" + v.getKey() + "}",
                before);
    }

    public List<VariableLogResponse> logs(AuthUser auth, long id) {
        User user = userService.require(auth.userId());
        Variable v = requireAdminVariable(user, id, true);
        return logs.findByVariableIdOrderByAtAscIdAsc(v.getId()).stream()
                .map(l -> new VariableLogResponse(l.getAt(), l.getActorId(), l.getAction(), l.getBefore(),
                        l.getAfter()))
                .toList();
    }

    /**
     * Change log of every variable of the project (deleted ones included), newest first, at most {@link #LIST_LIMIT}
     * entries, with the actor's name. Customer admins only.
     */
    public List<ProjectVariableLogResponse> projectLogs(AuthUser auth, long projectId) {
        User user = userService.require(auth.userId());
        Project project = projectAccess.requireProject(projectId);
        requireAdmin(user, project);
        List<VariableLog> entries = logs.findByProjectNewestFirst(project.getId(), PageRequest.of(0, LIST_LIMIT));
        Map<Long, User> actors = userService.byIds(entries.stream().map(VariableLog::getActorId)
                .filter(Objects::nonNull).distinct().toList());
        return entries.stream()
                .map(l -> {
                    User actor = l.getActorId() == null ? null : actors.get(l.getActorId());
                    return new ProjectVariableLogResponse(l.getVariableId(), l.getAt(), l.getActorId(),
                            actor == null ? null : actor.getName(), l.getAction(), l.getBefore(), l.getAfter());
                })
                .toList();
    }

    /**
     * The variable when the user administers its customer. Users who can work in the project but are not admins get
     * FORBIDDEN; anyone else NOT_FOUND.
     */
    private Variable requireAdminVariable(User user, long id, boolean includeDeleted) {
        Variable v = variables.findById(id).orElseThrow(BusinessException::notFound);
        if (v.isDeleted() && !includeDeleted) {
            throw BusinessException.notFound();
        }
        requireAdmin(user, projectAccess.requireProject(v.getProjectId()));
        return v;
    }

    /** Admins of the project's customer pass; members who are not admins get FORBIDDEN, anyone else NOT_FOUND. */
    private void requireAdmin(User user, Project project) {
        if (userService.actorOf(user).adminOf(project.getCustomerId())) {
            return;
        }
        if (projectAccess.canWorkIn(user, project)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, ADMIN_REQUIRED);
        }
        throw BusinessException.notFound();
    }

    private void rejectDuplicate(long projectId, String key, Long selfId) {
        boolean exists = variables.findByProjectIdAndKeyIgnoreCase(projectId, key).stream()
                .anyMatch(other -> !other.getId().equals(selfId));
        if (exists) {
            throw duplicate();
        }
    }

    private static BusinessException duplicate() {
        return new BusinessException(ErrorCode.DUPLICATE, "이미 등록된 변수입니다. 기존 변수를 사용하세요");
    }

    private static void checkKey(String key) {
        VariableRules.checkKey(key).ifPresent(message -> {
            throw BusinessException.validation("key", message);
        });
    }

    private static void checkValue(VariableType type, String value) {
        Optional<String> error = VariableRules.checkValue(type, value);
        if (error.isPresent()) {
            throw BusinessException.validation("value", error.get());
        }
    }

    private static String description(String raw) {
        String d = raw == null ? "" : raw.trim();
        if (d.length() > MAX_DESCRIPTION_LENGTH) {
            throw BusinessException.validation("description", "설명은 최대 200자입니다");
        }
        return d;
    }

    static boolean inUse(String key, List<String> payloads) {
        return payloads.stream().anyMatch(p -> VariableTokens.contains(p, key));
    }

    private String snapshot(Variable v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", v.getKey());
        m.put("type", v.getType().name());
        m.put("value", v.getValue());
        m.put("active", v.isActive());
        return json.writeValueAsString(m);
    }

    private static VariableResponse response(Variable v, boolean inUse) {
        return new VariableResponse(v.getId(), v.getProjectId(), v.getKey(), v.getDescription(), v.getType(),
                v.getValue(), v.isActive(), inUse, v.getCreatedBy(), v.getCreatedAt(), v.getUpdatedAt(), v.isDeleted());
    }
}
