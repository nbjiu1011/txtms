package com.txtms.domain.mail;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboundEmailRepository extends JpaRepository<OutboundEmail, Long> {

    Page<OutboundEmail> findByCustomerIdOrderByCreatedAtDescIdDesc(Long customerId, Pageable pageable);

    Page<OutboundEmail> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    /** Mails due for a delivery attempt, longest waiting first. */
    List<OutboundEmail> findByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAscIdAsc(String status, Instant now,
            Pageable pageable);
}
