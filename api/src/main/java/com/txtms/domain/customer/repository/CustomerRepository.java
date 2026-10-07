package com.txtms.domain.customer.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.txtms.domain.customer.entity.Customer;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
}
