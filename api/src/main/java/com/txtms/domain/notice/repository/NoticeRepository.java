package com.txtms.domain.notice.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.notice.entity.Notice;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findByCustomerIdAndWithdrawnFalseOrderByCreatedAtDescIdDesc(Long customerId);
}
