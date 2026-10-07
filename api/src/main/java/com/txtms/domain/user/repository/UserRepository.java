package com.txtms.domain.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.user.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    List<User> findByCustomerIdOrderByIdAsc(Long customerId);

    List<User> findByIdIn(Collection<Long> ids);
}
