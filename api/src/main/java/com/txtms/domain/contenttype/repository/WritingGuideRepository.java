package com.txtms.domain.contenttype.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.contenttype.entity.ContentType;
import com.txtms.domain.contenttype.entity.WritingGuide;

public interface WritingGuideRepository extends JpaRepository<WritingGuide, ContentType> {
}
