package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.ContentVersion;

public interface ContentVersionRepository extends JpaRepository<ContentVersion, Long> {

    List<ContentVersion> findByContentIdInOrderByVersionAsc(Collection<Long> contentIds);

    Optional<ContentVersion> findByContentIdAndVersion(Long contentId, int version);

    Optional<ContentVersion> findFirstByContentIdOrderByVersionDesc(Long contentId);
}
