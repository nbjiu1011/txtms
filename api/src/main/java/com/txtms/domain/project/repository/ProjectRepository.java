package com.txtms.domain.project.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.project.entity.Project;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByCustomerIdOrderByIdAsc(Long customerId);

    @Query("select distinct p from Project p join p.members m where m.userId = :userId order by p.id")
    List<Project> findByMemberUserId(@Param("userId") Long userId);

    /** Projects per customer: rows of {@code [customerId, count]}. */
    @Query("select p.customerId, count(p) from Project p group by p.customerId")
    List<Object[]> countByCustomer();

    /** Current variables revision read from the row (not the possibly stale entity in the persistence context). */
    @Query("select p.variablesRevision from Project p where p.id = :id")
    Integer findVariablesRevision(@Param("id") Long id);

    /**
     * Projects of the customer with history that forbids deleting them (contract §24): any request (drafts included),
     * notice (also as the previous scope of an edited one) or variable (deleted ones included).
     */
    @Query(value = "SELECT p.id FROM projects p WHERE p.customer_id = :customerId AND ("
            + "EXISTS (SELECT 1 FROM requests r WHERE r.project_id = p.id)"
            + " OR EXISTS (SELECT 1 FROM notices n WHERE n.project_id = p.id)"
            + " OR EXISTS (SELECT 1 FROM notice_logs l WHERE l.previous_project_id = p.id)"
            + " OR EXISTS (SELECT 1 FROM variables v WHERE v.project_id = p.id))", nativeQuery = true)
    List<Long> findIdsWithHistory(@Param("customerId") Long customerId);

    /** Atomic increment (the entity never writes this column). */
    @Modifying(flushAutomatically = true)
    @Query("update Project p set p.variablesRevision = p.variablesRevision + 1 where p.id = :id")
    int incrementVariablesRevision(@Param("id") Long id);
}
