package com.txtms.global.audit;

import java.time.Instant;
import java.util.Collection;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findByCustomerIdOrderByAtDescIdDesc(Long customerId, Pageable pageable);

    Page<AuditLog> findAllByOrderByAtDescIdDesc(Pageable pageable);

    /** Retention: deletes records of the given actions written before {@code before}. */
    @Modifying(flushAutomatically = true)
    @Query("delete from AuditLog a where a.action in :actions and a.at < :before")
    int deleteByActionInAndAtBefore(@Param("actions") Collection<String> actions, @Param("before") Instant before);
}
