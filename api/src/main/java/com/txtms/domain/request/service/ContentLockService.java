package com.txtms.domain.request.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.request.repository.ContentRepository;

/** Content edit locks. */
@Service
public class ContentLockService {

    private final ContentRepository contentRepository;

    public ContentLockService(ContentRepository contentRepository) {
        this.contentRepository = contentRepository;
    }

    /** Releases every lock held by the user (logout). */
    @Transactional
    public int releaseAllOf(long userId) {
        return contentRepository.releaseLocksOf(userId);
    }
}
