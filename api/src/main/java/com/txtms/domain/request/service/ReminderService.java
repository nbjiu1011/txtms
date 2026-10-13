package com.txtms.domain.request.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.txtms.domain.customer.entity.Customer;
import com.txtms.domain.customer.entity.NotifyChannel;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.mail.MailKind;
import com.txtms.domain.mail.MailSender;
import com.txtms.domain.mail.MailTemplates;
import com.txtms.domain.notification.service.NotificationService;
import com.txtms.domain.notification.service.NotificationService.Original;
import com.txtms.domain.request.entity.Request;
import com.txtms.domain.request.policy.RequestPolicy;
import com.txtms.domain.request.repository.RequestReminderRepository;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.config.AppProperties;

/**
 * Re-notification scheduler (actions.md §8.3). For every request still in progress and every recipient of an
 * original notification about it who still has work to do there ({@link RequestPolicy#isPendingFor}), applies
 * {@link ReminderRules} with the state in {@code request_reminders}. Each request runs in its own transaction under
 * its row lock (a due date change, which clears the state, waits for it).
 */
@Service
public class ReminderService {

    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    private final NotificationService notifications;
    private final RequestWriteSupport support;
    private final RequestReminderRepository reminders;
    private final RequestPolicy policy;
    private final UserService userService;
    private final CustomerService customerService;
    private final MailSender mailSender;
    private final MailTemplates mailTemplates;
    private final Clock clock;
    private final Duration interval;
    private final int maxCount;
    private final String webBaseUrl;
    private final TransactionTemplate tx;

    public ReminderService(NotificationService notifications, RequestWriteSupport support,
            RequestReminderRepository reminders, RequestPolicy policy, UserService userService,
            CustomerService customerService, MailSender mailSender,
            MailTemplates mailTemplates, Clock clock, AppProperties properties,
            PlatformTransactionManager transactionManager) {
        this.notifications = notifications;
        this.support = support;
        this.reminders = reminders;
        this.policy = policy;
        this.userService = userService;
        this.customerService = customerService;
        this.mailSender = mailSender;
        this.mailTemplates = mailTemplates;
        this.clock = clock;
        this.interval = properties.reminder().interval();
        this.maxCount = properties.reminder().maxCount();
        this.webBaseUrl = properties.webBaseUrl();
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** One scheduler run. Returns the number of reminders written. */
    public int run() {
        return run(id -> true);
    }

    /** A run limited to the requests the filter accepts (tests keep other tenants untouched). */
    public int run(java.util.function.Predicate<String> requestFilter) {
        Map<String, List<Original>> byRequest = new LinkedHashMap<>();
        for (Original o : notifications.latestOriginalsOfOpenRequests()) {
            if (!requestFilter.test(o.requestId())) {
                continue;
            }
            byRequest.computeIfAbsent(o.requestId(), k -> new java.util.ArrayList<>()).add(o);
        }
        int sent = 0;
        for (Map.Entry<String, List<Original>> e : byRequest.entrySet()) {
            try {
                Integer n = tx.execute(status -> remindRequest(e.getKey(), e.getValue()));
                sent += n == null ? 0 : n;
            } catch (RuntimeException ex) {
                log.warn("Re-notification failed for {}", e.getKey(), ex);
            }
        }
        return sent;
    }

    private int remindRequest(String requestId, List<Original> originals) {
        Optional<ScopedRequest> locked = support.lockForSystem(requestId);
        if (locked.isEmpty()) {
            return 0;
        }
        ScopedRequest s = locked.get();
        Request r = s.request();
        Customer customer = customerService.find(s.project().customerId()).orElse(null);
        if (customer == null) {
            return 0;
        }
        boolean emailChannel = customer.getNotifyChannel() == NotifyChannel.IN_APP_EMAIL;
        Map<Long, User> users = userService.byIds(originals.stream().map(Original::userId).toList());
        Instant now = clock.instant();
        int sent = 0;
        for (Original o : originals) {
            User user = users.get(o.userId());
            if (user == null || !policy.isPendingFor(userService.actorOf(user), s.project(), s.facts())) {
                continue;
            }
            ReminderRules.Decision d = ReminderRules.decide(reminders.find(requestId, o.userId()).orElse(null),
                    o.createdAt(), r.getStatus(), r.getDueDate(), s.project().dueSoonDays(), now, interval, maxCount,
                    emailChannel);
            if (d.state() != null) {
                reminders.save(requestId, o.userId(), d.state());
            }
            if (!d.send()) {
                continue;
            }
            String text = ReminderRules.text(d.urgent(), d.count(), maxCount, r.getTitle());
            notifications.remind(o.id(), ReminderRules.kind(d.urgent(), o.kind()), text);
            if (d.email()) {
                Map<String, Object> model = new HashMap<>();
                model.put("name", user.getName());
                model.put("text", text);
                model.put("urgent", d.urgent());
                model.put("count", d.count());
                model.put("maxCount", maxCount);
                model.put("intervalHours", Math.max(1, interval.toHours()));
                model.put("title", r.getTitle());
                model.put("requestId", r.getId());
                model.put("link", webBaseUrl + "/requests/" + r.getId());
                mailSender.send(MailKind.REMINDER, customer.getId(), user.getEmail(),
                        mailTemplates.render(MailTemplates.Template.REMINDER,
                                text.length() > 200 ? text.substring(0, 200) : text, model));
            }
            sent++;
        }
        return sent;
    }
}
