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

    /** Contents of the requests that were created from a completed content (follow-up lineage). */
    List<Content> findByRequestIdInAndParentRequestIdIsNotNull(Collection<String> requestIds);

    /** Current payloads of every request of a project (variable usage). */
    @Query(value = "SELECT c.payload FROM contents c JOIN requests r ON r.id = c.request_id "
            + "WHERE r.project_id = :projectId AND c.deleted = FALSE", nativeQuery = true)
    List<String> findCurrentPayloadsOfProject(@Param("projectId") Long projectId);

    @Modifying(flushAutomatically = true)
    @Query("update Content c set c.lockUserId = null, c.lockAt = null where c.lockUserId = :userId")
    int releaseLocksOf(@Param("userId") Long userId);

    /**
     * Conditional lock acquire/refresh: succeeds only when the content is unlocked, locked by the same user, or the
     * lock expired ({@code lock_at <= expiredBefore}). Returns the number of updated rows (0 = someone else holds it).
     */
    @Modifying(flushAutomatically = true)
    @Query("update Content c set c.lockUserId = :userId, c.lockAt = :now where c.id = :id and c.deleted = false "
            + "and (c.lockUserId is null or c.lockUserId = :userId or c.lockAt <= :expiredBefore)")
    int tryLock(@Param("id") Long id, @Param("userId") Long userId, @Param("now") java.time.Instant now,
            @Param("expiredBefore") java.time.Instant expiredBefore);

    /** Requests with at least one expired content lock (automatic release job). */
    @Query("select distinct c.requestId from Content c where c.lockUserId is not null and c.lockAt <= :expiredBefore")
    List<String> findRequestIdsWithExpiredLocks(@Param("expiredBefore") java.time.Instant expiredBefore);
}
