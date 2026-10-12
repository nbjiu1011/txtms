package com.txtms.domain.user.service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.request.policy.Actor;
import com.txtms.domain.user.dto.UserSummary;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.repository.UserRepository;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository repository;
    private final CustomerService customerService;

    public UserService(UserRepository repository, CustomerService customerService) {
        this.repository = repository;
        this.customerService = customerService;
    }

    public User require(long id) {
        return repository.findById(id).orElseThrow(BusinessException::notFound);
    }

    public Optional<User> find(long id) {
        return repository.findById(id);
    }

    public Optional<User> findByEmail(String email) {
        return email == null ? Optional.empty() : repository.findByEmail(email.trim().toLowerCase());
    }

    /**
     * Changes the sign-in email and writes it at once, so an address taken by another account in the meantime fails
     * here as {@code DUPLICATE} (unique key) instead of at commit.
     */
    @Transactional
    public void changeEmail(User user, String email, java.time.Instant now, String duplicateMessage) {
        user.changeEmail(email, now);
        try {
            repository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.DUPLICATE, duplicateMessage);
        }
    }

    /** Persists a new account (invitation). */
    @Transactional
    public User create(User user) {
        return repository.save(user);
    }

    public Map<Long, User> byIds(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return repository.findByIdIn(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    public List<User> byCustomer(long customerId) {
        return repository.findByCustomerIdOrderByIdAsc(customerId);
    }

    /** Customer admins whose account can be used now (active, not pending), ordered by id. */
    public List<Long> activeAdminIdsOf(long customerId) {
        return repository.findAdminsOf(customerId).stream().filter(this::canUseAccount).map(User::getId).toList();
    }

    /** Active admins (usable accounts) of the customer, ordered by id. */
    public List<User> activeAdminsOf(long customerId) {
        return repository.findAdminsOf(customerId).stream().filter(this::canUseAccount).toList();
    }

    /** Number of users per customer id (pending and inactive included). */
    public Map<Long, Long> countByCustomer() {
        Map<Long, Long> counts = new java.util.HashMap<>();
        for (Object[] row : repository.countByCustomer()) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    /** An account may sign in and call the API only while it and its customer are active. */
    public boolean canUseAccount(User user) {
        if (!user.isActive() || user.isPending()) {
            return false;
        }
        if (user.getCustomerId() == null) {
            return user.isOperator();
        }
        return customerService.find(user.getCustomerId()).map(Customer::isActive).orElse(false);
    }

    /** Policy view of a user. Admin rights on inactive customers are dropped. */
    public Actor actorOf(User user) {
        Map<Long, Customer> admin = customerService.byIds(user.getAdminCustomerIds());
        return new Actor(user.getId(), user.getCustomerId(), canUseAccount(user), user.isOperator(),
                admin.values().stream().filter(Customer::isActive).map(Customer::getId)
                        .collect(Collectors.toSet()));
    }

    public static UserSummary summary(User u) {
        return new UserSummary(u.getId(), u.getName(), u.getDept(), u.getEmail(), u.isActive(), u.getAvatarColor());
    }
}
