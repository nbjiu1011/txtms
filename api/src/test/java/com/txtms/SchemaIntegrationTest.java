package com.txtms;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.txtms.support.IntegrationTestConfig;

/** Flyway migrates an empty database and Hibernate validates every entity against it. */
@Tag("integration")
@SpringBootTest
@ActiveProfiles("it")
@Import(IntegrationTestConfig.class)
class SchemaIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void migratesAndValidates() {
        Integer applied = jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success = 1", Integer.class);
        assertThat(applied).isPositive();
    }
}
