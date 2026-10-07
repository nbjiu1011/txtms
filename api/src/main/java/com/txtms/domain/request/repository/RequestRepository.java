package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.Request;

public interface RequestRepository extends JpaRepository<Request, String> {

    List<Request> findByProjectIdIn(Collection<Long> projectIds);

    /** Row lock (MySQL and MariaDB) serializing every write on one request. Returns the id when it exists. */
    @org.springframework.data.jpa.repository.Query(value = "SELECT id FROM requests WHERE id = :id FOR UPDATE",
            nativeQuery = true)
    java.util.Optional<String> lockById(@org.springframework.data.repository.query.Param("id") String id);
}
