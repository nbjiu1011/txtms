package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.entity.EmailChange;
import com.txtms.domain.auth.repository.EmailChangeRepository;
import com.txtms.domain.mail.MailKind;
import com.txtms.domain.mail.MailSender;
import com.txtms.domain.user.entity.User;
import com.txtms.global.config.AppProperties;

/**
 * Email change links of accepted users: the new address takes effect only when the link mailed to it is used
 * ({@code POST /api/auth/tokens/{token}/email-change}). A request revokes every unused link of the user, stores only
 * the SHA-256 of the new token (valid {@code app.auth.email-change-ttl}, 24 hours) and queues the mail
 * {@code TX TMS 이메일 변경 확인} with {@code {web}/email-change/{token}} to the new address.
 */
@Service
public class EmailChangeService {

    public static final String SUBJECT = "TX TMS 이메일 변경 확인";

    private final EmailChangeRepository changes;
    private final MailSender mailSender;
    private final Clock clock;
    private final AppProperties properties;

    public EmailChangeService(EmailChangeRepository changes, MailSender mailSender, Clock clock,
            AppProperties properties) {
        this.changes = changes;
        this.mailSender = mailSender;
        this.clock = clock;
        this.properties = properties;
    }

    /** Revokes the user's unused links and mails a new one to {@code newEmail}. Returns the outbox id. */
    @Transactional(propagation = Propagation.MANDATORY)
    public long request(User user, String newEmail, Long createdBy) {
        Instant now = clock.instant();
        changes.findByUserId(user.getId()).forEach(c -> c.revoke(now));
        String token = OpaqueTokens.generate();
        changes.save(new EmailChange(user.getId(), OpaqueTokens.hash(token), newEmail, now,
                now.plus(properties.auth().emailChangeTtl()), createdBy));
        String link = properties.webBaseUrl() + "/email-change/" + token;
        long hours = Math.max(1, properties.auth().emailChangeTtl().toHours());
        return mailSender.send(MailKind.EMAIL_CHANGE, user.getCustomerId(), newEmail, SUBJECT,
                user.getName() + "님, TX TMS 로그인 이메일을 이 주소로 바꾸는 요청이 접수되었습니다. 아래 링크에서 "
                        + hours + "시간 안에 확인하면 변경됩니다. 요청한 적이 없다면 이 메일을 무시하세요.\n" + link);
    }

    /**
     * Revokes every unused link of the user.
     *
     * @return the new address that was waiting for confirmation, or null when none was
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public String cancel(User user) {
        Instant now = clock.instant();
        String pending = null;
        for (EmailChange c : changes.findByUserId(user.getId())) {
            if (c.isUsable(now)) {
                pending = c.getNewEmail();
            }
            c.revoke(now);
        }
        return pending;
    }

    /** The address awaiting confirmation per user (users without a usable link are absent). */
    @Transactional(readOnly = true)
    public Map<Long, String> pendingEmails(Collection<Long> userIds) {
        Map<Long, String> result = new HashMap<>();
        if (userIds.isEmpty()) {
            return result;
        }
        Instant now = clock.instant();
        Map<Long, EmailChange> latest = new HashMap<>();
        for (EmailChange c : changes.findByUserIdIn(userIds)) {
            if (c.isUsable(now)) {
                latest.merge(c.getUserId(), c, (a, b) -> a.getId() > b.getId() ? a : b);
            }
        }
        latest.forEach((userId, c) -> result.put(userId, c.getNewEmail()));
        return result;
    }

    /** The address awaiting confirmation of one user, or null. */
    @Transactional(readOnly = true)
    public String pendingEmail(long userId) {
        return pendingEmails(List.of(userId)).get(userId);
    }
}
