package com.txtms.domain.demo;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.customer.repository.CustomerRepository;
import com.txtms.domain.notice.entity.Notice;
import com.txtms.domain.notice.entity.NoticeScope;
import com.txtms.domain.notice.repository.NoticeRepository;
import com.txtms.domain.notification.entity.Notification;
import com.txtms.domain.notification.entity.NotificationKind;
import com.txtms.domain.notification.repository.NotificationRepository;
import com.txtms.domain.project.entity.Project;
import com.txtms.domain.project.entity.ProjectRole;
import com.txtms.domain.project.repository.ProjectRepository;
import com.txtms.domain.request.entity.CompletionBundle;
import com.txtms.domain.request.entity.CompletionBundleItem;
import com.txtms.domain.request.entity.Content;
import com.txtms.domain.request.entity.ContentFile;
import com.txtms.domain.request.entity.ContentFileVersion;
import com.txtms.domain.request.entity.ContentVersion;
import com.txtms.domain.request.entity.FileScanStatus;
import com.txtms.domain.request.entity.FileUnit;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.entity.RequestAsk;
import com.txtms.domain.request.entity.RequestHistory;
import com.txtms.domain.request.entity.RequestOpinion;
import com.txtms.domain.request.entity.RequestStatus;
import com.txtms.domain.request.entity.Urgency;
import com.txtms.domain.request.repository.CompletionBundleItemRepository;
import com.txtms.domain.request.repository.CompletionBundleRepository;
import com.txtms.domain.request.repository.ContentFileRepository;
import com.txtms.domain.request.repository.ContentFileVersionRepository;
import com.txtms.domain.request.repository.ContentRepository;
import com.txtms.domain.request.repository.ContentVersionRepository;
import com.txtms.domain.request.repository.RequestAskRepository;
import com.txtms.domain.request.repository.RequestHistoryRepository;
import com.txtms.domain.request.repository.RequestOpinionRepository;
import com.txtms.domain.request.repository.RequestRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.repository.UserRepository;
import com.txtms.global.common.Kst;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

import tools.jackson.databind.json.JsonMapper;

/**
 * Demo data for local development and demonstrations (two sample customers, three projects, twelve users and
 * twelve requests in every workflow state). The full seed runs only in demo mode and only on an empty database. All
 * times are relative to the seeding moment so "due soon" and "overdue" demos keep working.
 * <p>
 * Reset mode ({@link #reseedSampleRequests}, the operator's {@code 샘플 초기화}): after the caller removed the sample
 * customers' requests, the seed requests of the seed customers among them (한빛카드, 도담생명, found by domain) are
 * written again with their history, opinions, questions, completion bundles and notifications, anchored at now.
 * Customers, users, projects, variables and datasets are not touched; seed users and projects are found by email
 * and by name.
 */
@Component
@Order(1)
public class DemoDataSeeder implements ApplicationRunner {

    /** Seed customer keys and their domains. */
    public static final Map<String, String> SEED_CUSTOMERS = Map.of("c1", DemoDatasets.HANBIT, "c2",
            DemoDatasets.DODAM);

    /** Seed projects: key to customer key and name. */
    private static final Map<String, List<String>> SEED_PROJECTS = Map.of(
            "p1", List.of("c1", "카드 혜택 알림"),
            "p2", List.of("c1", "리스크 고지 문자"),
            "p3", List.of("c2", "계약 유지 안내"));

    /** Seed user emails by key (the reset finds the seed users by email). */
    private static final Map<String, String> SEED_USER_EMAILS = Map.ofEntries(
            Map.entry("u1", "seoyeon.kim@hanbitcard.co.kr"), Map.entry("u2", "jihoon.park@hanbitcard.co.kr"),
            Map.entry("u3", "dohyun.lee@hanbitcard.co.kr"), Map.entry("u4", "mina.choi@hanbitcard.co.kr"),
            Map.entry("u5", "woojin.jung@txtms.io"), Map.entry("u6", "gaeul.han@hanbitcard.co.kr"),
            Map.entry("u7", "serin.oh@hanbitcard.co.kr"), Map.entry("u8", "taeo.yoon@dodamlife.com"),
            Map.entry("u9", "jia.moon@dodamlife.com"), Map.entry("u10", "hajun.shin@dodamlife.com"),
            Map.entry("u11", "minho.kang@hanbitcard.co.kr"), Map.entry("u12", "aram.seo@dodamlife.com"));

    /** The seed customer key of each seed request (p1, p2: c1; p3: c2). Ids are fixed across resets. */
    private static final Map<String, String> SEED_CUSTOMER_OF_REQUEST = Map.ofEntries(
            Map.entry("REQ-2609-101", "c1"), Map.entry("REQ-2609-102", "c1"), Map.entry("REQ-2609-103", "c1"),
            Map.entry("REQ-2609-104", "c1"), Map.entry("REQ-2609-105", "c1"), Map.entry("REQ-2609-088", "c1"),
            Map.entry("REQ-2609-106", "c1"), Map.entry("REQ-2609-107", "c1"), Map.entry("REQ-2609-110", "c1"),
            Map.entry("REQ-2609-113", "c1"), Map.entry("REQ-2609-111", "c2"), Map.entry("REQ-2609-112", "c2"));

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final CustomerRepository customers;
    private final UserRepository users;
    private final ProjectRepository projects;
    private final RequestRepository requests;
    private final ContentRepository contents;
    private final ContentVersionRepository contentVersions;
    private final ContentFileRepository files;
    private final ContentFileVersionRepository fileVersions;
    private final RequestOpinionRepository opinions;
    private final RequestAskRepository asks;
    private final RequestHistoryRepository history;
    private final CompletionBundleRepository bundles;
    private final CompletionBundleItemRepository bundleItems;
    private final NotificationRepository notifications;
    private final NoticeRepository notices;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JsonMapper json;
    private final Clock clock;
    private final AppProperties properties;

    public DemoDataSeeder(CustomerRepository customers, UserRepository users, ProjectRepository projects,
            RequestRepository requests, ContentRepository contents, ContentVersionRepository contentVersions, ContentFileRepository files,
            ContentFileVersionRepository fileVersions, RequestOpinionRepository opinions, RequestAskRepository asks,
            RequestHistoryRepository history, CompletionBundleRepository bundles,
            CompletionBundleItemRepository bundleItems, NotificationRepository notifications,
            NoticeRepository notices, JdbcTemplate jdbc, PasswordEncoder passwordEncoder, JsonMapper json,
            Clock clock, AppProperties properties) {
        this.customers = customers;
        this.users = users;
        this.projects = projects;
        this.requests = requests;
        this.contents = contents;
        this.contentVersions = contentVersions;
        this.files = files;
        this.fileVersions = fileVersions;
        this.opinions = opinions;
        this.asks = asks;
        this.history = history;
        this.bundles = bundles;
        this.bundleItems = bundleItems;
        this.notifications = notifications;
        this.notices = notices;
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.json = json;
        this.clock = clock;
        this.properties = properties;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.demo().enabled()) {
            return;
        }
        if (customers.count() > 0) {
            log.info("Demo seed skipped: database already has customers");
            return;
        }
        new Seeding(clock.instant(), null).run();
        log.info("Demo data seeded (demo default password {})",
                properties.demo().hasDefaultPassword() ? "applied to demo accounts" : "not configured");
    }

    /** Customer ids of the seed customers (by domain) among {@code customerIds}, keyed {@code c1}/{@code c2}. */
    public Map<String, Long> seedCustomersAmong(java.util.Collection<Long> customerIds) {
        Map<String, Long> found = new HashMap<>();
        SEED_CUSTOMERS.forEach((key, domain) -> customers.findByDomain(domain)
                .filter(c -> c.isSample() && customerIds.contains(c.getId()))
                .ifPresent(c -> found.put(key, c.getId())));
        return found;
    }

    /** Seed request ids of the given seed customer keys. */
    public static List<String> seedRequestIdsOf(java.util.Collection<String> customerKeys) {
        return SEED_CUSTOMER_OF_REQUEST.entrySet().stream().filter(e -> customerKeys.contains(e.getValue()))
                .map(Map.Entry::getKey).sorted().toList();
    }

    /**
     * Reset mode: writes the seed requests of the seed customers among {@code customerIds} again (the caller has
     * removed their requests in the same transaction). A seed user or project that cannot be found (email or name
     * changed) fails with {@code REQUEST_STATE_CONFLICT}, which rolls the whole reset back. Returns the number of
     * restored requests.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int reseedSampleRequests(java.util.Collection<Long> customerIds) {
        Map<String, Long> found = seedCustomersAmong(customerIds);
        if (found.isEmpty()) {
            return 0;
        }
        Seeding seeding = new Seeding(clock.instant(), found.keySet());
        found.forEach((key, id) -> seeding.c.put(key, customers.findById(id).orElseThrow()));
        return seeding.reseed();
    }

    /** One seeding run anchored at {@code now}. */
    private final class Seeding {

        private final ZonedDateTime anchor;
        private final Instant now;
        private final Map<String, User> u = new HashMap<>();
        private final Map<String, Customer> c = new HashMap<>();
        private final Map<String, Project> p = new HashMap<>();
        private final Map<Long, List<Map<String, Object>>> varsByProject = new HashMap<>();
        /** Reset mode: the seed customer keys whose requests are written again; null for the full seed. */
        private final java.util.Set<String> resetKeys;
        private int restored;

        Seeding(Instant now, java.util.Set<String> resetKeys) {
            this.now = now;
            this.anchor = now.atZone(Kst.ZONE);
            this.resetKeys = resetKeys == null ? null : java.util.Set.copyOf(resetKeys);
        }

        boolean resetting() {
            return resetKeys != null;
        }

        /** Reset mode: seed variables only as bundle snapshots, then the requests and their notifications. */
        int reseed() {
            seedVariables();
            seedRequests();
            seedNotifications();
            return restored;
        }

        /** Whether the seed request belongs to a customer being written (always true for the full seed). */
        boolean included(RequestSeed seed) {
            return includedRequest(seed.id());
        }

        boolean includedRequest(String requestId) {
            return !resetting() || resetKeys.contains(SEED_CUSTOMER_OF_REQUEST.get(requestId));
        }

        User userOf(String key) {
            User user = u.get(key);
            if (user == null && resetting()) {
                String email = SEED_USER_EMAILS.get(key);
                user = users.findByEmail(email).orElseThrow(() -> conflict(email));
                u.put(key, user);
            }
            return user;
        }

        Project project(String key) {
            Project project = p.get(key);
            if (project == null && resetting()) {
                List<String> def = SEED_PROJECTS.get(key);
                Customer customer = c.get(def.get(0));
                if (customer == null) {
                    throw conflict(SEED_CUSTOMERS.get(def.get(0)));
                }
                project = projects.findByCustomerIdOrderByIdAsc(customer.getId()).stream()
                        .filter(x -> x.getName().equals(def.get(1))).findFirst()
                        .orElseThrow(() -> conflict(def.get(1)));
                p.put(key, project);
            }
            return project;
        }

        BusinessException conflict(String what) {
            return new BusinessException(ErrorCode.REQUEST_STATE_CONFLICT,
                    "샘플 고객사 구성이 시드와 달라 복원할 수 없습니다 (" + what + ")");
        }

        /** Prototype {@code at(d, h, m)}: d days from now at h:m KST. */
        Instant at(int days, int hour, int minute) {
            return anchor.plusDays(days).with(LocalTime.of(hour, minute)).truncatedTo(ChronoUnit.MINUTES)
                    .toInstant();
        }

        Instant at(int days) {
            return at(days, 10, 0);
        }

        LocalDate day(int days) {
            return anchor.plusDays(days).toLocalDate();
        }

        void run() {
            seedCustomersAndUsers();
            seedProjects();
            seedVariables();
            seedDatasets();
            seedNotices();
            seedRequests();
            seedNotifications();
            jdbc.update("INSERT INTO request_sequences (name, seq_value) VALUES ('REQUEST', 120)");
        }

        // ------------------------------------------------------------------ organization

        void seedCustomersAndUsers() {
            c.put("c1", customers.save(new Customer("한빛카드", "hanbitcard.co.kr", true, true, NotifyChannel.IN_APP, 3,
                    null, at(-120))));
            c.put("c2", customers.save(new Customer("도담생명", "dodamlife.com", false, true, NotifyChannel.IN_APP, 3,
                    null, at(-74))));

            user("u1", "c1", "김서연", "카드마케팅팀", "seoyeon.kim@hanbitcard.co.kr", "#3C6E71", false);
            user("u2", "c1", "박지훈", "콘텐츠검수팀", "jihoon.park@hanbitcard.co.kr", "#8C5E3C", false);
            user("u3", "c1", "이도현", "콘텐츠검수팀", "dohyun.lee@hanbitcard.co.kr", "#4B5D9A", false);
            user("u4", "c1", "최민아", "마케팅본부", "mina.choi@hanbitcard.co.kr", "#7A4A8C", false);
            user("u5", null, "정우진", "서비스운영", "woojin.jung@txtms.io", "#2F3B52", true);
            user("u6", "c1", "한가을", "콘텐츠검수팀", "gaeul.han@hanbitcard.co.kr", "#A0473F", false);
            user("u7", "c1", "오세린", "리스크관리팀", "serin.oh@hanbitcard.co.kr", "#5E7F3A", false);
            user("u8", "c2", "윤태오", "고객소통파트", "taeo.yoon@dodamlife.com", "#3A6E8F", false);
            user("u9", "c2", "문지아", "계약관리팀", "jia.moon@dodamlife.com", "#9A6B2F", false);
            user("u10", "c2", "신하준", "고객소통파트", "hajun.shin@dodamlife.com", "#6A6F7A", false);
            user("u11", "c1", "강민호", "경영지원팀", "minho.kang@hanbitcard.co.kr", "#45606B", false);
            user("u12", "c2", "서아람", "디지털기획팀", "aram.seo@dodamlife.com", "#8A5F7A", false);
            u.get("u11").grantCustomerAdmin(c.get("c1").getId());
            u.get("u12").grantCustomerAdmin(c.get("c2").getId());

            if (properties.demo().hasDefaultPassword()) {
                String hash = passwordEncoder.encode(properties.demo().defaultPassword());
                u.values().forEach(user -> user.changePasswordHash(hash, now));
            }
            users.saveAll(u.values());
            c.get("c1").backdate(at(-120), id("u5"));
            c.get("c2").backdate(at(-74), id("u5"));
        }

        void user(String key, String customerKey, String name, String dept, String email, String color,
                boolean operator) {
            Long customerId = customerKey == null ? null : c.get(customerKey).getId();
            Instant created = "c2".equals(customerKey) ? at(-74) : at(-120);
            u.put(key, users.save(new User(customerId, email, name, dept, operator, true, color, created)));
        }

        long id(String userKey) {
            return userOf(userKey).getId();
        }

        void seedProjects() {
            Project p1 = new Project(c.get("c1").getId(), SEED_PROJECTS.get("p1").get(1), id("u5"), at(-119));
            p1.addRole(id("u1"), ProjectRole.REQUESTER);
            p1.addRole(id("u2"), ProjectRole.REVIEWER);
            p1.addRole(id("u6"), ProjectRole.REVIEWER);
            p1.addRole(id("u4"), ProjectRole.APPROVER);
            p1.assignLead(id("u3"));
            p1.addTemplate("HB_POINT_01", "포인트 적립 안내");
            p1.addTemplate("HB_BILL_02", "청구 금액 안내");
            p1.addTemplate("HB_EVT_03", "이벤트 당첨 안내");
            p1.addSender("1588-0000");
            p1.addSender("02-3456-7000");
            p.put("p1", projects.save(p1));

            Project p2 = new Project(c.get("c1").getId(), SEED_PROJECTS.get("p2").get(1), id("u5"), at(-119));
            p2.addRole(id("u7"), ProjectRole.REQUESTER);
            p2.addRole(id("u2"), ProjectRole.REVIEWER);
            p2.addRole(id("u4"), ProjectRole.APPROVER);
            p2.assignLead(id("u3"));
            p2.addSender("1588-0000");
            p.put("p2", projects.save(p2));

            Project p3 = new Project(c.get("c2").getId(), SEED_PROJECTS.get("p3").get(1), id("u5"), at(-73));
            p3.addRole(id("u9"), ProjectRole.REQUESTER);
            p3.addRole(id("u10"), ProjectRole.REVIEWER);
            p3.assignLead(id("u8"));
            p3.addTemplate("DD_PAY_01", "보험료 납입 안내");
            p3.addSender("1577-1234");
            p.put("p3", projects.save(p3));
        }

        // ------------------------------------------------------------------ variables / datasets

        void seedVariables() {
            variable("p1", "customer_name", "수신 고객 이름", "홍길동", "u5", -40);
            variable("p1", "points", "이벤트 적립 예정 포인트", "5,000", "u1", -30);
            variable("p1", "event_period", "이벤트 진행 기간", "10/1~10/31", "u1", -30);
            variable("p1", "billing_amount", "당월 청구 금액", "152,300원", "u5", -40);
            variable("p1", "payment_day", "카드 결제일", "25일", "u5", -40);
            variable("p1", "card_name", "보유 카드 상품명", "한빛 프리미엄", "u2", -12);
            variable("p2", "customer_name", "수신 고객 이름", "홍길동", "u5", -40);
            variable("p2", "reference_date", "금리 적용 기준일", "10월 1일", "u7", -9);
            variable("p3", "customer_name", "계약자 이름", "홍길동", "u5", -50);
            variable("p3", "due_date", "보험료 납입일", "10월 5일", "u9", -20);
            variable("p3", "premium", "월 납입 보험료", "48,200원", "u9", -20);
            if (resetting()) {
                return;
            }
            varsByProject.forEach((projectId, vars) -> jdbc.update(
                    "UPDATE projects SET variables_revision = ? WHERE id = ?", vars.size(), projectId));
        }

        void variable(String projectKey, String key, String description, String value, String byKey, int days) {
            if (resetting()) {
                // reset mode: only the bundle snapshot of the seed variables (variables themselves stay as they are)
                if (resetKeys.contains(SEED_PROJECTS.get(projectKey).get(0))) {
                    varsByProject.computeIfAbsent(project(projectKey).getId(), k -> new ArrayList<>())
                            .add(ordered("key", key, "type", "TEXT", "value", value));
                }
                return;
            }
            long projectId = p.get(projectKey).getId();
            Instant created = at(days);
            jdbc.update("INSERT INTO variables (project_id, var_key, description, var_type, value, active, deleted, "
                    + "created_by, created_at, updated_at) VALUES (?, ?, ?, 'TEXT', ?, 1, 0, ?, ?, ?)",
                    projectId, key, description, value, id(byKey), ts(created), ts(created));
            Long variableId = jdbc.queryForObject("SELECT id FROM variables WHERE project_id = ? AND var_key = ?",
                    Long.class, projectId, key);
            Map<String, Object> snapshot = ordered("key", key, "type", "TEXT", "value", value);
            Map<String, Object> after = new LinkedHashMap<>(snapshot);
            after.put("active", true);
            jdbc.update("INSERT INTO variable_logs (variable_id, at, actor_id, action, before_json, after_json) "
                    + "VALUES (?, ?, ?, '등록', NULL, ?)", variableId, ts(created), id(byKey), write(after));
            varsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(snapshot);
        }

        /** One dataset v1 per Phase 1 content type and the planned assignments ({@link DemoDatasets}). */
        void seedDatasets() {
            Map<ContentType, Long> byType = new HashMap<>();
            for (ContentType type : DemoDatasets.TYPES) {
                byType.put(type, dataset(type.name(), 1, -50, DemoDatasets.rules(type)));
            }
            Map<String, String> customerKeys = Map.of(DemoDatasets.HANBIT, "c1", DemoDatasets.DODAM, "c2");
            for (DemoDatasets.PlannedAssignment a : DemoDatasets.ASSIGNMENTS) {
                assign(customerKeys.get(a.customerDomain()), a.type().name(), byType.get(a.type()), -45,
                        a.confirmed() ? -44 : null);
            }
        }

        long dataset(String scope, int version, int days, List<CorrectionRule> rules) {
            jdbc.update("INSERT INTO datasets (scope, version, created_at, created_by) VALUES (?, ?, ?, ?)", scope,
                    version, ts(at(days)), id("u5"));
            Long datasetId = jdbc.queryForObject("SELECT id FROM datasets WHERE scope = ? AND version = ?",
                    Long.class, scope, version);
            int order = 0;
            for (CorrectionRule r : rules) {
                jdbc.update("INSERT INTO dataset_rules (dataset_id, sort_order, rule_id, original_expr, "
                        + "recommended_expr, original_pattern, recommended_pattern, description_label, description) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", datasetId, order++, r.ruleId(), r.originalExpr(),
                        r.recommendedExpr(), r.originalPattern(), r.recommendedPattern(), r.descriptionLabel(),
                        r.description());
            }
            return datasetId;
        }

        void assign(String customerKey, String type, long datasetId, int assignedDays, Integer checkedDays) {
            jdbc.update("INSERT INTO dataset_assignments (customer_id, type, dataset_id, assigned_at, assigned_by, "
                    + "checked_at, checked_by) VALUES (?, ?, ?, ?, ?, ?, ?)", c.get(customerKey).getId(), type,
                    datasetId, ts(at(assignedDays)), id("u5"), checkedDays == null ? null : ts(at(checkedDays)),
                    checkedDays == null ? null : id("u5"));
        }

        // ------------------------------------------------------------------ notices / notifications

        void seedNotices() {
            notices.save(new Notice(NoticeScope.CUSTOMER, c.get("c1").getId(), null, "10월 정기 점검 시간 안내",
                    "10월 3일(토) 02:00부터 04:00까지 서비스를 이용할 수 없습니다. 이 시간에는 자동 저장도 멈춥니다.", id("u11"),
                    at(-2, 9, 0)));
            notices.save(new Notice(NoticeScope.PROJECT, c.get("c1").getId(), p.get("p1").getId(), "추석 연휴 검수 일정",
                    "9월 24일부터 26일까지는 긴급 요청만 배정합니다. 일반 요청의 확정 납기는 연휴 이후로 조정됩니다.", id("u11"),
                    at(-4, 11, 0)));
        }

        void seedNotifications() {
            if (includedRequest("REQ-2609-104")) {
                LocalDate due104 = requests.findById("REQ-2609-104").map(Request::getDueDate).orElseThrow();
                notify("u3", at(-1, 10, 0), NotificationKind.ASSIGN, "REQ-2609-104",
                        "신규 검수 요청이 배정을 기다립니다. 확정 납기 " + due104.getMonthValue() + "월 "
                                + due104.getDayOfMonth() + "일",
                        false, false, "u1");
            }
            notify("u1", at(-1, 16, 0), NotificationKind.ASK, "REQ-2609-102", "이도현님이 확인을 요청했습니다: 면제 기간 종료일",
                    false, false, "u3");
            notify("u2", at(0, 9, 0), NotificationKind.RECALL, "REQ-2609-107",
                    "김서연님이 회수를 요청했습니다. 승인 또는 거절이 필요합니다.", false, false, "u1");
            notify("u4", at(-3, 17, 0), NotificationKind.APPROVAL, "REQ-2609-103",
                    "승인 대기 요청이 있습니다: 프리미엄 카드 리뉴얼 안내", true, false, "u3");
            notify("u6", at(0, 8, 0), NotificationKind.DUE, "REQ-2609-113", "확정 납기가 지났습니다: 카드 분실 신고 안내 개편",
                    false, true, null);
            notify("u8", at(-1, 15, 0), NotificationKind.ASSIGN, "REQ-2609-112", "신규 검수 요청이 배정을 기다립니다.",
                    false, false, "u9");
            notify("u1", at(-5, 11, 0), NotificationKind.FINAL, "REQ-2609-106", "청구 금액 안내 (9월) 요청이 승인 완료되었습니다.",
                    true, false, "u4");
        }

        void notify(String userKey, Instant at, NotificationKind kind, String requestId, String text, boolean read,
                boolean renotify, String actorKey) {
            if (!includedRequest(requestId)) {
                return;
            }
            Notification n = new Notification(id(userKey), kind, requestId, text, at, renotify,
                    actorKey == null ? null : id(actorKey));
            if (read) {
                n.markRead(at);
            }
            notifications.save(n);
        }

        // ------------------------------------------------------------------ requests

        void seedRequests() {
            RequestSeed r101 = new RequestSeed(101, "p1", "10월 포인트 적립 이벤트 알림톡", ContentType.ALIMTALK,
                    RequestStatus.IN_REVIEW, "u1", at(-3, 9, 0), at(-3, 10, 0), day(2))
                    .info("10월 적립 이벤트 참여 유도", "최근 3개월 결제 고객", "분기 말 이용 실적 방어", "2026 Q4 적립")
                    .reviewers("u2", "u6").primary("u2");
            r101.content("이벤트 참여 안내", alimtalk("HB_POINT_01",
                    "#{customer_name}님, 10월 한 달 동안 결제하시면 최대 #{points} 포인트가 적립 되요.\n\n이벤트 기간: #{event_period}\n아래 버튼을 클릭하세요.",
                    button("이벤트 참여하기", "https://hanbitcard.co.kr/evt/oct")));
            r101.content("적립 예정 안내", alimtalk("HB_POINT_01",
                    "#{customer_name}님, 이벤트 조건을 충족해 #{points} 포인트가 적립될 예정입니다.  적립일은 11월 10일입니다.",
                    button("적립 내역 보기", "https://hanbitcard.co.kr/point"))).lockedBy = "u6";
            r101.content("미참여 고객 리마인드", alimtalk("HB_EVT_03",
                    "#{customer_name}님, 아직 이벤트에 참여하지 않으셨어요. 지금 참여하면 혜택을 드립니다. 이벤트는 #{마감일}까지입니다.",
                    button("참여하기", "hanbitcard.co.kr/evt/oct")));

            RequestSeed r102 = new RequestSeed(102, "p1", "해외 결제 수수료 면제 안내 문자", ContentType.SMS,
                    RequestStatus.CONFIRMING, "u1", at(-4), at(-4, 11, 0), day(1))
                    .info("해외 결제 수수료 면제 프로모션 안내", "해외 결제 이력 고객", "연말 해외 여행 수요", null)
                    .reviewers("u3").primary("u3");
            r102.content("면제 안내 본문", sms("1588-0000",
                    "(광고)[한빛카드] 해외 결제 수수료가 10월 31일까지 면제됩니다. 면제 대상 카드는 홈페이지에서 확인하실 수 있습니다.", true, true));
            r102.content("카드사 앱 유도", sms("1588-0000",
                    "(광고)[한빛카드] 한빛카드 앱에서 해외 결제 내역을 확인하시고 수수료 면제 혜택을 받아보세요.", false, false));

            RequestSeed r103 = new RequestSeed(103, "p1", "프리미엄 카드 리뉴얼 안내", ContentType.ALIMTALK,
                    RequestStatus.APPROVAL_WAITING, "u1", at(-9), at(-9, 10, 0), day(3))
                    .info("리뉴얼 카드 혜택 소개", "프리미엄 카드 보유 고객", "10월 리뉴얼 출시", "프리미엄 리뉴얼")
                    .reviewers("u2", "u3").primary("u3").round(2);
            r103.content("리뉴얼 혜택 안내", alimtalk("HB_EVT_03",
                    "#{customer_name}님, 프리미엄 카드가 새로워졌습니다. 연회비는 그대로, 공항 라운지 이용 횟수는 두 배로 늘었습니다."
                            + " 해외 가맹점 결제 시 결제 금액의 2%를 포인트로 적립해 드립니다.",
                    button("혜택 자세히 보기", "https://hanbitcard.co.kr/premium"))).extraVersion("u2", at(-4, 13, 0));

            RequestSeed r104 = new RequestSeed(104, "p1", "추석 연휴 고객센터 운영 안내", ContentType.SMS,
                    RequestStatus.WAITING, "u1", at(-1, 9, 0), at(-1, 10, 0), day(1))
                    .info("연휴 기간 상담 운영 시간 안내", "전체 회원", "연휴 상담 수요 분산", null).urgent();
            r104.content("운영 시간 안내", sms("1588-0000",
                    "[한빛카드] 추석 연휴(9/24~9/26) 고객센터는 분실 신고만 24시간 운영합니다. 일반 상담은 9월 27일부터 가능합니다.", true, false));

            RequestSeed r105 = new RequestSeed(105, "p1", "연말 캐시백 알림톡", ContentType.ALIMTALK, RequestStatus.DRAFT,
                    "u1", at(0, 11, 0), null, day(8))
                    .info("연말 캐시백 이벤트 사전 안내", null, null, "2026 Q4 적립");
            r105.content("캐시백 사전 안내", alimtalk("",
                    "#{customer_name}님, 12월 한 달 동안 결제 금액의 최대 3%를 캐시백해 드려요. 참여 신청은 11월 25일부터 할수 있습니다."));

            RequestSeed r088 = new RequestSeed(88, "p1", "청구 금액 안내 (8월)", ContentType.ALIMTALK,
                    RequestStatus.APPROVED, "u1", at(-34), at(-34, 10, 0), day(-30))
                    .info("월 청구 금액 안내", "전체 회원", "정기 발송", null)
                    .reviewers("u2").primary("u2").completed("u4", at(-30, 10, 0));
            r088.content("청구 금액 안내", alimtalk("HB_BILL_02",
                    "#{customer_name}님, 8월 청구 금액은 #{billing_amount}입니다.\n결제일: #{payment_day}",
                    button("청구 내역 보기", "https://hanbitcard.co.kr/bill")));

            RequestSeed r106 = new RequestSeed(106, "p1", "청구 금액 안내 (9월)", ContentType.ALIMTALK,
                    RequestStatus.APPROVED, "u1", at(-8), at(-8, 10, 0), day(-5))
                    .info("월 청구 금액 안내", "전체 회원", "정기 발송", null)
                    .reviewers("u2", "u6").primary("u6").parent("REQ-2609-088", "C1").completed("u4", at(-5, 11, 0));
            r106.content("청구 금액 안내", alimtalk("HB_BILL_02",
                    "#{customer_name}님, 9월 청구 금액은 #{billing_amount}입니다.\n결제일: #{payment_day}\n결제일 전날까지 계좌 잔액을 확인해 주세요.",
                    button("청구 내역 보기", "https://hanbitcard.co.kr/bill")));

            RequestSeed r107 = new RequestSeed(107, "p1", "회원 약관 개정 고지문", ContentType.FREEFORM,
                    RequestStatus.IN_REVIEW, "u1", at(-2), at(-2, 14, 0), day(4))
                    .info("약관 개정 사전 고지", "전체 회원", "11월 1일 약관 개정", null)
                    .reviewers("u2", "u3").primary("u2");
            r107.content("약관 개정 고지문", freeform("회원 약관 개정 안내", "")).file = new FileSeed(
                    "회원약관_개정고지_v3.pdf", "pdf", FileUnit.PAGE, 14, 6, "1~6쪽 (개정 조항)");

            RequestSeed r110 = new RequestSeed(110, "p2", "금리 변동 위험 고지 문자", ContentType.SMS,
                    RequestStatus.IN_REVIEW, "u7", at(-2), at(-2, 9, 0), day(2))
                    .info("카드론 금리 변동 고지", "카드론 이용 고객", "기준금리 변경", null)
                    .reviewers("u2").primary("u2");
            r110.content("금리 변동 고지", sms("1588-0000",
                    "[한빛카드] #{customer_name}님, #{reference_date}부터 카드론 금리가 변경됩니다. 자세한 내용은 홈페이지를 확인해 주세요.", true,
                    false));

            RequestSeed r113 = new RequestSeed(113, "p1", "카드 분실 신고 안내 개편", ContentType.SMS,
                    RequestStatus.IN_REVIEW, "u1", at(-6), at(-6, 10, 0), day(-1))
                    .info("분실 신고 절차 안내 개편", "신규 발급 고객", "분실 신고 문의 증가", null)
                    .reviewers("u6").primary("u6").urgent();
            r113.content("분실 신고 절차", sms("02-3456-7000",
                    "[한빛카드] 카드를 잃어버리셨나요? 앱 첫 화면의 분실 신고 버튼으로 바로 신고하실수 있습니다.", true, false));

            RequestSeed r111 = new RequestSeed(111, "p3", "10월 보험료 납입 안내", ContentType.ALIMTALK,
                    RequestStatus.REVIEW_COMPLETED, "u9", at(-5), at(-5, 10, 0), day(-2))
                    .info("보험료 정기 납입 안내", "자동이체 미등록 계약자", "미납 예방", null)
                    .reviewers("u8", "u10").primary("u8").completed("u8", at(-2, 16, 0));
            r111.content("납입 안내", alimtalk("DD_PAY_01",
                    "#{customer_name}님, 10월 보험료 #{premium}의 납입일은 #{due_date}입니다.",
                    button("납입하기", "https://dodamlife.com/pay")));

            RequestSeed r112 = new RequestSeed(112, "p3", "실효 예정 계약 안내", ContentType.SMS, RequestStatus.WAITING,
                    "u9", at(-1), at(-1, 15, 0), day(3))
                    .info("실효 예정 계약 안내", "2회 이상 미납 계약자", "계약 유지율 관리", null);
            r112.content("실효 예정 안내", sms("1577-1234",
                    "[도담생명] #{customer_name}님의 보험 계약이 보험료 미납으로 실효될 예정입니다. 금일 중 납입하시면 계약이 유지됩니다.", true,
                    false));

            List<RequestSeed> all = List.of(r101, r102, r103, r104, r105, r088, r106, r107, r110, r113, r111, r112);
            for (RequestSeed seed : all) {
                if (included(seed)) {
                    persist(seed);
                    restored++;
                }
            }
            if (included(r101)) {
                hanbitEvents(r101, r102, r103, r107, r106, r088);
            }
            if (included(r111)) {
                freeze(r111);
            }
        }

        /** Events beyond create / submit / assign of the 한빛카드 seed requests (prototype history seed). */
        void hanbitEvents(RequestSeed r101, RequestSeed r102, RequestSeed r103, RequestSeed r107, RequestSeed r106,
                RequestSeed r088) {

            opinions.save(new RequestOpinion(r101.id(), "C2", id("u6"),
                    "연속 공백이 있습니다. 적립일 표기를 청구 안내와 같은 형식으로 맞추면 좋겠습니다.", 1, at(-1, 15, 0)));
            hist(r101, at(-1, 15, 0), "u6", "검수 의견", "연속 공백이 있습니다. 적립일 표기를 청구 안내와 같은 형식으로 맞추면 좋겠습니다.", "C2", 1);

            String question = "면제 기간 종료일이 10월 31일로 되어 있는데, 상품 안내 페이지에는 11월 30일로 나옵니다. 어느 쪽이 맞을까요?";
            asks.save(new RequestAsk(r102.id(), "C1", id("u3"), question, at(-1, 16, 0), 1));
            hist(r102, at(-1, 16, 0), "u3", "확인 요청", question, "C1", 1);

            hist(r103, at(-6, 11, 0), "u3", "검수 완료", "주담당 검수 완료, 승인 대기로 전환", null, 1);
            hist(r103, at(-5, 10, 0), "u4", "수정 요청",
                    "사유: 라운지 이용 횟수 표기 근거 필요\n위치: 카드 1 본문\n기대 내용: 정확한 횟수(연 4회→8회)로 표기", null, 1);
            hist(r103, at(-5, 10, 1), "u4", "재검수 시작", "승인자 수정 요청으로 2차 검수 시작", null, 2);
            hist(r103, at(-4, 13, 0), "u2", "문안 수정", "v1 → v2  본문 수정", "C1", 2);
            hist(r103, at(-3, 17, 0), "u3", "검수 완료", "주담당 검수 완료, 승인 대기로 전환", null, 2);

            hist(r107, at(0, 9, 0), "u1", "회수 요청", "법무팀 최종본이 변경되어 파일을 교체하려 합니다.", null, 1);
            requests.findById(r107.id()).orElseThrow()
                    .markRecallRequested(id("u1"), at(0, 9, 0), "법무팀 최종본이 변경되어 파일을 교체하려 합니다.");

            hist(r106, at(-6, 17, 0), "u6", "검수 완료", "주담당 검수 완료, 승인 대기로 전환", null, 1);
            freeze(r106);
            hist(r088, at(-31, 17, 0), "u2", "검수 완료", "승인 대기로 전환", null, 1);
            freeze(r088);
        }

        void persist(RequestSeed s) {
            Project project = project(s.projectKey);
            Request r = new Request(s.id(), project.getId(), s.type, id(s.requesterKey), s.createdAt);
            r.describe(s.title, s.purpose, s.target, s.background, s.campaign);
            r.schedule(s.dueDate, s.dueDate, s.urgency);
            List<Long> reviewerIds = s.reviewerKeys.stream().map(this::id).toList();
            r.restoreSeedState(s.status, s.round, s.submittedAt, s.completedAt, reviewerIds,
                    s.primaryKey == null ? null : id(s.primaryKey));
            if (s.parentRequestId != null) {
                r.linkParent(s.parentRequestId, s.parentContentKey);
            }
            requests.save(r);

            int order = 0;
            for (ContentSeed cs : s.contents) {
                order++;
                String key = "C" + order;
                Content content = new Content(r.getId(), key, cs.title, write(cs.payload), order, s.createdAt);
                if (s.parentRequestId != null) {
                    content.linkParent(s.parentRequestId, key);
                }
                content.restoreSeedVersion(cs.extraVersionAt == null ? 1 : 2);
                if (cs.lockedBy != null) {
                    content.acquireLock(id(cs.lockedBy), now);
                }
                contents.save(content);
                cs.contentId = content.getId();

                List<Map<String, Object>> fileSnapshot = new ArrayList<>();
                if (cs.file != null) {
                    Instant fileAt = s.submittedAt != null ? s.submittedAt : s.createdAt;
                    FileSeed f = cs.file;
                    ContentFile file = new ContentFile(content.getId(), f.name, f.ext, f.unit, 1_048_576L, 1, fileAt,
                            id(s.requesterKey));
                    file.describeRange(f.total, f.review, f.rangeNote);
                    files.save(file);
                    // seed metadata only: no stored binary
                    fileVersions.save(new ContentFileVersion(file.getId(), 1, f.name, 1_048_576L, null,
                            FileScanStatus.SAFE, fileAt, id(s.requesterKey)));
                    fileSnapshot.add(fileMeta(file, fileAt, id(s.requesterKey)));
                }
                cs.filesJson = write(fileSnapshot);

                if (s.status != RequestStatus.DRAFT) {
                    contentVersions.save(new ContentVersion(content.getId(), 1, cs.title, write(cs.payload),
                            cs.filesJson, s.submittedAt, id(s.requesterKey)));
                    if (cs.extraVersionAt != null) {
                        contentVersions.save(new ContentVersion(content.getId(), 2, cs.title, write(cs.payload),
                                cs.filesJson, cs.extraVersionAt, id(cs.extraVersionBy)));
                    }
                }
            }

            hist(s, s.createdAt, s.requesterKey, "요청 작성", null, null, 1);
            if (s.status == RequestStatus.DRAFT) {
                return;
            }
            hist(s, s.submittedAt, s.requesterKey, "검수 요청", null, null, 1);
            if (s.status == RequestStatus.WAITING) {
                return;
            }
            String names = String.join(", ", s.reviewerKeys.stream().map(k -> userOf(k).getName()).toList());
            // actor = the project's lead (a reset keeps a lead the customer admin changed after the seed)
            history.save(new RequestHistory(s.id(), s.submittedAt.plusSeconds(3600), project.getLeadUserId(),
                    "검수자 배정", names + " 배정, 주담당 " + userOf(s.primaryKey).getName(), null, null, 1));
        }

        /** Freezes the completion bundle of a finally completed request. */
        void freeze(RequestSeed s) {
            long projectId = project(s.projectKey).getId();
            bundles.save(new CompletionBundle(s.id(), s.status, s.completedAt, id(s.completedByKey),
                    write(varsByProject.getOrDefault(projectId, List.of()))));
            int order = 0;
            for (ContentSeed cs : s.contents) {
                order++;
                Content content = contents.findById(cs.contentId).orElseThrow();
                bundleItems.save(new CompletionBundleItem(s.id(), "C" + order, cs.title, content.getVersion(),
                        write(cs.payload), cs.filesJson, order));
            }
            String action = s.status == RequestStatus.APPROVED ? "승인 완료" : "검수 완료";
            hist(s, s.completedAt, s.completedByKey, action, "완료 묶음 고정", null, s.round);
        }

        void hist(RequestSeed s, Instant at, String actorKey, String action, String detail, String contentKey,
                int round) {
            String contentTitle = null;
            if (contentKey != null) {
                int index = Integer.parseInt(contentKey.substring(1)) - 1;
                contentTitle = s.contents.get(index).title;
            }
            history.save(new RequestHistory(s.id(), at, id(actorKey), action, detail, contentKey, contentTitle,
                    round));
        }

        Map<String, Object> fileMeta(ContentFile f, Instant at, long by) {
            Map<String, Object> version = ordered("version", 1, "name", f.getName(), "createdAt", at.toString(),
                    "createdBy", by, "sizeBytes", f.getSizeBytes());
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("id", f.getId());
            meta.put("name", f.getName());
            meta.put("ext", f.getExt());
            meta.put("unit", f.getUnit().name());
            meta.put("sizeBytes", f.getSizeBytes());
            meta.put("totalAmount", f.getTotalAmount());
            meta.put("reviewAmount", f.getReviewAmount());
            meta.put("rangeNote", f.getRangeNote());
            meta.put("version", 1);
            meta.put("scanStatus", FileScanStatus.SAFE.name());
            meta.put("versions", List.of(version));
            return meta;
        }

        // ------------------------------------------------------------------ payload builders (contract keys)

        @SafeVarargs
        final Map<String, Object> alimtalk(String templateCode, String body, Map<String, Object>... buttons) {
            return ordered("templateCode", templateCode, "body", body, "buttons", List.of(buttons));
        }

        Map<String, Object> button(String name, String link) {
            return ordered("name", name, "link", link);
        }

        Map<String, Object> sms(String sender, String body, boolean customerCenter, boolean optOut) {
            return ordered("sender", sender, "body", body, "customerCenter", customerCenter, "optOut", optOut);
        }

        Map<String, Object> freeform(String title, String text) {
            return ordered("title", title, "text", text);
        }
    }

    /** Request under construction for the seed. */
    private static final class RequestSeed {
        final int number;
        final String projectKey;
        final String title;
        final ContentType type;
        final RequestStatus status;
        final String requesterKey;
        final Instant createdAt;
        final Instant submittedAt;
        final LocalDate dueDate;
        String purpose;
        String target;
        String background;
        String campaign;
        Urgency urgency = Urgency.NORMAL;
        int round = 1;
        List<String> reviewerKeys = List.of();
        String primaryKey;
        String parentRequestId;
        String parentContentKey;
        String completedByKey;
        Instant completedAt;
        final List<ContentSeed> contents = new ArrayList<>();

        RequestSeed(int number, String projectKey, String title, ContentType type, RequestStatus status,
                String requesterKey, Instant createdAt, Instant submittedAt, LocalDate dueDate) {
            this.number = number;
            this.projectKey = projectKey;
            this.title = title;
            this.type = type;
            this.status = status;
            this.requesterKey = requesterKey;
            this.createdAt = createdAt;
            this.submittedAt = submittedAt;
            this.dueDate = dueDate;
        }

        String id() {
            return "REQ-2609-" + String.format("%03d", number);
        }

        RequestSeed info(String purpose, String target, String background, String campaign) {
            this.purpose = purpose;
            this.target = target;
            this.background = background;
            this.campaign = campaign;
            return this;
        }

        RequestSeed reviewers(String... keys) {
            this.reviewerKeys = List.of(keys);
            return this;
        }

        RequestSeed primary(String key) {
            this.primaryKey = key;
            return this;
        }

        RequestSeed round(int round) {
            this.round = round;
            return this;
        }

        RequestSeed urgent() {
            this.urgency = Urgency.URGENT;
            return this;
        }

        RequestSeed parent(String requestId, String contentKey) {
            this.parentRequestId = requestId;
            this.parentContentKey = contentKey;
            return this;
        }

        RequestSeed completed(String byKey, Instant at) {
            this.completedByKey = byKey;
            this.completedAt = at;
            return this;
        }

        ContentSeed content(String title, Map<String, Object> payload) {
            ContentSeed c = new ContentSeed(title, payload);
            contents.add(c);
            return c;
        }
    }

    private static final class ContentSeed {
        final String title;
        final Map<String, Object> payload;
        String lockedBy;
        FileSeed file;
        String extraVersionBy;
        Instant extraVersionAt;
        Long contentId;
        String filesJson;

        ContentSeed(String title, Map<String, Object> payload) {
            this.title = title;
            this.payload = payload;
        }

        /** A second version saved by a reviewer (same payload). */
        ContentSeed extraVersion(String byKey, Instant at) {
            this.extraVersionBy = byKey;
            this.extraVersionAt = at;
            return this;
        }
    }

    private record FileSeed(String name, String ext, FileUnit unit, int total, int review, String rangeNote) {
    }

    private String write(Object value) {
        return json.writeValueAsString(value);
    }

    /** UTC wall-clock value, matching how Hibernate stores Instant (hibernate.jdbc.time_zone=UTC). */
    private static java.time.LocalDateTime ts(Instant instant) {
        return java.time.LocalDateTime.ofInstant(instant, java.time.ZoneOffset.UTC);
    }

    private static <V> Map<String, V> ordered(Object... keyValues) {
        Map<String, V> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            @SuppressWarnings("unchecked")
            V value = (V) keyValues[i + 1];
            map.put((String) keyValues[i], value);
        }
        return map;
    }
}
