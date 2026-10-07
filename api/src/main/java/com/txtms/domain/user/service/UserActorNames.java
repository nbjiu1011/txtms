package com.txtms.domain.user.service;

import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.repository.UserRepository;
import com.txtms.global.audit.ActorNames;

/** Current user names for audit listings. */
@Component
public class UserActorNames implements ActorNames {

    private final UserRepository repository;

    public UserActorNames(UserRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, String> namesOf(Collection<Long> userIds) {
        return repository.findByIdIn(userIds).stream().collect(Collectors.toMap(User::getId, User::getName));
    }
}
