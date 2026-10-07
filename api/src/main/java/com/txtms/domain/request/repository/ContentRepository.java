package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.request.entity.Content;

public interface ContentRepository extends JpaRepository<Content, Long> {

    List<Content> findByRequestIdInAndDeletedFalseOrderBySortOrderAsc(Collection<String> requestIds);

    List<Content> findByRequestIdAndDeletedFalseOrderBySortOrderAsc(String requestId);

    /** Every content row of the request, deleted ones included (key numbering). */
    List<Content> findByRequestIdOrderBySortOrderAsc(String requestId);

    java.util.Optional<Content> findByRequestIdAndKeyAndDeletedFalse(String requestId, String key);

    /** Any content row with the key, deleted ones included (old versions and downloads). */
    java.util.Optional<Content> findByRequestIdAndKey(String requestId, String key);

    /** Current payloads of every request of a project (variable usage). */
    @Query(value = "SELECT c.payload FROM contents c JOIN requests r ON r.id = c.request_id "
            + "WHERE r.project_id = :projectId AND c.deleted = FALSE", nativeQuery = true)
    List<String> findCurrentPayloadsOfProject(@Param("projectId") Long projectId);

    @Modifying(flushAutomatically = true)
    @Query("update Content c set c.lockUserId = null, c.lockAt = null where c.lockUserId = :userId")
    int releaseLocksOf(@Param("userId") Long userId);
}
