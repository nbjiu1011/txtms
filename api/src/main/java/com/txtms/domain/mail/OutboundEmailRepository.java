package com.txtms.domain.mail;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboundEmailRepository extends JpaRepository<OutboundEmail, Long> {

    Page<OutboundEmail> findByCustomerIdOrderByCreatedAtDescIdDesc(Long customerId, Pageable pageable);
}
