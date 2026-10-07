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

    /** Users per customer (pending and inactive included): rows of {@code [customerId, count]}. */
    @org.springframework.data.jpa.repository.Query(
            "select u.customerId, count(u) from User u where u.customerId is not null group by u.customerId")
    List<Object[]> countByCustomer();

    /** Customer admins of the customer (any account state), ordered by id. */
    @org.springframework.data.jpa.repository.Query(
            "select u from User u where :customerId member of u.adminCustomerIds order by u.id")
    List<User> findAdminsOf(@org.springframework.data.repository.query.Param("customerId") Long customerId);
}
