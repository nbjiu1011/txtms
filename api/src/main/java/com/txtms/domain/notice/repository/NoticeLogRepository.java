package com.txtms.domain.notice.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.notice.entity.NoticeLog;

public interface NoticeLogRepository extends JpaRepository<NoticeLog, Long> {

    List<NoticeLog> findByNoticeIdInOrderByAtAscIdAsc(Collection<Long> noticeIds);
}
