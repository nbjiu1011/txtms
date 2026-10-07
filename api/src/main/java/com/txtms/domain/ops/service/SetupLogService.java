package com.txtms.domain.ops.service;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.ops.dto.OpsDtos.SetupLogEntry;
import com.txtms.domain.ops.entity.SetupLog;
import com.txtms.domain.ops.repository.SetupLogRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;

/** The operator's initial-setup log ({@code 시드 실행 이력}: target, actor, result). Written with the step itself. */
@Service
@Transactional(readOnly = true)
public class SetupLogService {

    static final int LIST_LIMIT = 500;

    private final SetupLogRepository repository;
    private final UserService users;
    private final Clock clock;

    public SetupLogService(SetupLogRepository repository, UserService users, Clock clock) {
        this.repository = repository;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(long customerId, Long actorId, String action, String target, String result) {
        repository.save(new SetupLog(customerId, clock.instant(), actorId, action, target, result));
    }

    /** Newest first, at most 500; {@code customerId} null = every customer. */
    public List<SetupLogEntry> list(Long customerId) {
        PageRequest page = PageRequest.of(0, LIST_LIMIT);
        List<SetupLog> logs = customerId == null ? repository.findAllByOrderByAtDescIdDesc(page)
                : repository.findByCustomerIdOrderByAtDescIdDesc(customerId, page);
        Map<Long, User> actors = users.byIds(logs.stream().map(SetupLog::getActorId).filter(Objects::nonNull)
                .distinct().toList());
        return logs.stream().map(l -> new SetupLogEntry(l.getId(), l.getCustomerId(), l.getAt(), l.getActorId(),
                l.getActorId() == null || !actors.containsKey(l.getActorId()) ? null
                        : actors.get(l.getActorId()).getName(),
                l.getAction(), l.getTarget(), l.getResult())).toList();
    }
}
