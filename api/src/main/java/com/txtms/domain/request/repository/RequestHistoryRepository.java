package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.txtms.domain.request.entity.RequestHistory;

public interface RequestHistoryRepository extends JpaRepository<RequestHistory, Long> {

    List<RequestHistory> findByRequestIdOrderByAtAscIdAsc(String requestId);

    List<RequestHistory> findByRequestIdInAndActionIn(Collection<String> requestIds, Collection<String> actions);

    @Query("select distinct h.requestId from RequestHistory h where h.actorId = :actorId and h.action in :actions")
    List<String> findRequestIdsByActorAndActions(@Param("actorId") Long actorId,
            @Param("actions") Collection<String> actions);
}
