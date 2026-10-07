package com.txtms.domain.demo;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.correction.engine.CorrectionRule;
import com.txtms.domain.correction.entity.Dataset;
import com.txtms.domain.correction.entity.DatasetAssignment;
import com.txtms.domain.correction.entity.DatasetScope;
import com.txtms.domain.correction.service.DatasetService;
import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;

/**
 * Brings the correction datasets and the demo customers' assignments of an <b>existing</b> development database up to
 * the current demo seed ({@link DemoDatasets}); the demo seeder itself only runs on an empty database. Dev only: it
 * needs demo mode and {@code app.demo.refresh-datasets=true} (e.g. {@code --app.demo.refresh-datasets=true} on a
 * one-off start against the dev database).
 * <p>
 * Non-destructive and idempotent: dataset versions are never changed or deleted. For each content type, when the
 * latest version's rules differ from the seed, a new version is added; the demo customers (한빛카드, 도담생명) are then
 * pointed at the latest versions as planned, their {@code COMMON} assignments (Phase 2 combination) and unplanned
 * type assignments are removed. Every change is audited as an operator action (the demo operator account).
 */
@Component
@Order(2)
@ConditionalOnProperty(prefix = "app.demo", name = {"enabled", "refresh-datasets"}, havingValue = "true")
public class DemoDatasetRefresher implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDatasetRefresher.class);
    static final String DEMO_OPERATOR = "woojin.jung@txtms.io";

    private final DatasetService datasets;
    private final CustomerService customers;
    private final UserService users;

    public DemoDatasetRefresher(DatasetService datasets, CustomerService customers, UserService users) {
        this.datasets = datasets;
        this.customers = customers;
        this.users = users;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Long operator = users.findByEmail(DEMO_OPERATOR).map(User::getId).orElse(null);
        Map<ContentType, Dataset> latest = new EnumMap<>(ContentType.class);
        for (ContentType type : ContentType.values()) {
            List<CorrectionRule> seed = DemoDatasets.rules(type);
            DatasetScope scope = DatasetScope.of(type);
            Optional<Dataset> current = datasets.latest(scope).filter(d -> datasets.rules(d.getId()).equals(seed));
            Dataset target = current.orElseGet(() -> datasets.createVersion(scope, seed, operator));
            log.info("Demo dataset {}: {} ({} rules){}", type, target.label(), seed.size(),
                    current.isPresent() ? " unchanged" : " added");
            latest.put(type, target);
        }
        for (Customer customer : customers.all()) {
            if (!customer.getDomain().equals(DemoDatasets.HANBIT) && !customer.getDomain().equals(DemoDatasets.DODAM)) {
                continue;
            }
            long id = customer.getId();
            if (datasets.findAssignment(id, DatasetScope.COMMON).isPresent()) {
                datasets.unassign(operator, id, DatasetScope.COMMON);
            }
            for (ContentType type : ContentType.values()) {
                Optional<DemoDatasets.PlannedAssignment> plan = DemoDatasets.ASSIGNMENTS.stream()
                        .filter(a -> a.customerDomain().equals(customer.getDomain()) && a.type() == type)
                        .findFirst();
                if (plan.isEmpty()) {
                    if (datasets.findAssignment(id, DatasetScope.of(type)).isPresent()) {
                        datasets.unassign(operator, id, DatasetScope.of(type));
                    }
                    continue;
                }
                DatasetAssignment a = datasets.assign(operator, id, latest.get(type));
                if (plan.get().confirmed() && a.getCheckedAt() == null) {
                    datasets.confirm(operator, id, DatasetScope.of(type));
                }
            }
        }
        log.info("Demo correction datasets and assignments refreshed");
    }
}
