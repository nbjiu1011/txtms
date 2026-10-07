package com.txtms.domain.request.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.request.entity.ContentImage;

public interface ContentImageRepository extends JpaRepository<ContentImage, Long> {

    Optional<ContentImage> findByImageKey(String imageKey);

    List<ContentImage> findByRequestIdAndImageKeyIn(String requestId, Collection<String> imageKeys);
}
