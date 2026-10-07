package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.ContentFileVersion;

public interface ContentFileVersionRepository extends JpaRepository<ContentFileVersion, Long> {

    List<ContentFileVersion> findByFileIdInOrderByVersionAsc(Collection<Long> fileIds);

    List<ContentFileVersion> findByFileIdOrderByVersionAsc(Long fileId);

    java.util.Optional<ContentFileVersion> findByFileIdAndVersion(Long fileId, int version);
}
