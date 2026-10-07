package com.txtms.domain.contenttype.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.entity.ContentTypeSetting;

public interface ContentTypeSettingRepository extends JpaRepository<ContentTypeSetting, ContentType> {

    List<ContentTypeSetting> findAllByOrderBySortOrderAsc();
}
