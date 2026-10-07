package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.ContentFile;

public interface ContentFileRepository extends JpaRepository<ContentFile, Long> {

    List<ContentFile> findByContentIdInAndDeletedFalseOrderBySortOrderAsc(Collection<Long> contentIds);

    List<ContentFile> findByContentIdAndDeletedFalseOrderBySortOrderAsc(Long contentId);

    /** Every file row of the content, deleted ones included (sort order numbering). */
    List<ContentFile> findByContentId(Long contentId);
}
