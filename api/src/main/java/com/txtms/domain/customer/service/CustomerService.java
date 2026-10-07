package com.txtms.domain.customer.service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.repository.CustomerRepository;
import com.txtms.global.exception.BusinessException;

@Service
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository repository;

    public CustomerService(CustomerRepository repository) {
        this.repository = repository;
    }

    public Optional<Customer> find(Long id) {
        return id == null ? Optional.empty() : repository.findById(id);
    }

    public Customer require(long id) {
        return repository.findById(id).orElseThrow(BusinessException::notFound);
    }

    public List<Customer> all() {
        return repository.findAll(Sort.by("id"));
    }

    public Map<Long, Customer> byIds(Collection<Long> ids) {
        return repository.findAllById(ids).stream().collect(Collectors.toMap(Customer::getId, Function.identity()));
    }

    public boolean isEmpty() {
        return repository.count() == 0;
    }
}
