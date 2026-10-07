package com.txtms.domain.mail;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboundEmailRepository extends JpaRepository<OutboundEmail, Long> {
}
