package com.txtms.domain.notice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.notice.entity.Notice;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findByCustomerIdAndWithdrawnFalseOrderByCreatedAtDescIdDesc(Long customerId);

    /** Every notice of the customer, withdrawn ones included (admin management list). */
    List<Notice> findByCustomerIdOrderByCreatedAtDescIdDesc(Long customerId);
}
