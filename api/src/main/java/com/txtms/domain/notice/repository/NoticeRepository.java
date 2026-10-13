package com.txtms.domain.notice.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.notice.entity.Notice;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    /** Notices users may see: published and not deleted, most recently published first. */
    List<Notice> findByCustomerIdAndPublishedTrueAndDeletedFalseOrderByPublishedAtDescIdDesc(Long customerId);

    /** Admin management list: the customer's notices that are (not) deleted, newest first. */
    Page<Notice> findByCustomerIdAndDeletedOrderByCreatedAtDescIdDesc(Long customerId, boolean deleted,
            Pageable pageable);
}
