package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.correction.service.DatasetService;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.demo.DemoDatasetRefresher;
import com.txtms.domain.demo.DemoDatasets;
import com.txtms.domain.user.service.UserService;
import com.txtms.support.IntegrationTestBase;

/**
 * The dev refresh ({@code app.demo.refresh-datasets=true}) brings an older demo database to the current seed: COMMON
 * and unplanned assignments go away, planned ones point at a version whose rules equal the seed and are confirmed as
 * planned; a second run changes nothing.
 */
class DemoDatasetRefresherIntegrationTest extends IntegrationTestBase {

    @Autowired
    DatasetService datasets;

    @Autowired
    CustomerService customers;

    @Autowired
    UserService users;

    @Test
    void refreshBringsTheDemoAssignmentsToTheSeed() throws Exception {
        long hanbit = customerId(DemoDatasets.HANBIT);
        long dodam = customerId(DemoDatasets.DODAM);
        long anyDataset = jdbc.queryForObject("SELECT MIN(id) FROM datasets", Long.class);
        // an M0-style database: COMMON assignments, 도담생명 free-form assigned, a confirmation missing
        jdbc.update("INSERT INTO dataset_assignments (customer_id, type, dataset_id, assigned_at) VALUES "
                + "(?, 'COMMON', ?, NOW(6)), (?, 'COMMON', ?, NOW(6))", hanbit, anyDataset, dodam, anyDataset);
        Long freeform = jdbc.queryForObject("SELECT MIN(id) FROM datasets WHERE scope = 'FREEFORM'", Long.class);
        jdbc.update("INSERT INTO dataset_assignments (customer_id, type, dataset_id, assigned_at) VALUES "
                + "(?, 'FREEFORM', ?, NOW(6))", dodam, freeform);
        jdbc.update("UPDATE dataset_assignments SET checked_at = NULL, checked_by = NULL WHERE customer_id = ? "
                + "AND type = 'SMS'", hanbit);

        DemoDatasetRefresher refresher = new DemoDatasetRefresher(datasets, customers, users);
        refresher.run(null);

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dataset_assignments WHERE customer_id IN (?, ?) AND "
                + "type = 'COMMON'", Integer.class, hanbit, dodam)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM dataset_assignments WHERE customer_id = ? AND "
                + "type = 'FREEFORM'", Integer.class, dodam)).isZero();
        for (DemoDatasets.PlannedAssignment plan : DemoDatasets.ASSIGNMENTS) {
            long customer = customerId(plan.customerDomain());
            Long datasetId = jdbc.queryForObject("SELECT dataset_id FROM dataset_assignments WHERE customer_id = ? "
                    + "AND type = ?", Long.class, customer, plan.type().name());
            assertThat(datasets.rules(datasetId)).as(plan.toString()).isEqualTo(DemoDatasets.rules(plan.type()));
            if (plan.confirmed()) {
                assertThat(jdbc.queryForObject("SELECT checked_at IS NOT NULL FROM dataset_assignments WHERE "
                        + "customer_id = ? AND type = ?", Boolean.class, customer, plan.type().name()))
                        .as(plan.toString()).isTrue();
            }
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE customer_id = ? AND action = "
                + "'유효 데이터셋 해제' AND target = '공통'", Integer.class, hanbit)).isGreaterThanOrEqualTo(1);

        int datasetCount = jdbc.queryForObject("SELECT COUNT(*) FROM datasets", Integer.class);
        int auditCount = jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class);
        refresher.run(null);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM datasets", Integer.class)).isEqualTo(datasetCount);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs", Integer.class)).isEqualTo(auditCount);
        assertThat(datasets.effectiveLabel(hanbit, ContentType.ALIMTALK)).isPresent();
    }
}
