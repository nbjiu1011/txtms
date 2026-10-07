package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.entity.UserInvitation;
import com.txtms.domain.auth.repository.UserInvitationRepository;
import com.txtms.domain.mail.MailSender;
import com.txtms.domain.user.entity.User;
import com.txtms.global.config.AppProperties;

/**
 * Invitation links (actions.md §7.3): issuing revokes every unused link of the user, stores only the SHA-256 of the
 * new token (valid {@code app.auth.invitation-ttl}, 7 days) and queues the mail {@code TX TMS 초대} with
 * {@code {web}/invite/{token}}. Acceptance is {@code POST /api/auth/tokens/{token}/password}.
 */
@Service
public class InvitationService {

    public static final String SUBJECT = "TX TMS 초대";

    private final UserInvitationRepository invitations;
    private final MailSender mailSender;
    private final Clock clock;
    private final AppProperties properties;

    public InvitationService(UserInvitationRepository invitations, MailSender mailSender, Clock clock,
            AppProperties properties) {
        this.invitations = invitations;
        this.mailSender = mailSender;
        this.clock = clock;
        this.properties = properties;
    }

    /** Revokes the user's unused links and sends a new one. Returns the new link's expiry. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Instant issue(User user, Long createdBy, String customerName) {
        Instant now = clock.instant();
        invitations.findByUserIdOrderByIdDesc(user.getId()).forEach(i -> i.revoke(now));
        String token = OpaqueTokens.generate();
        Instant expiresAt = now.plus(properties.auth().invitationTtl());
        invitations.save(new UserInvitation(user.getId(), OpaqueTokens.hash(token), now, expiresAt, createdBy));
        String link = properties.webBaseUrl() + "/invite/" + token;
        mailSender.send(user.getCustomerId(), user.getEmail(), SUBJECT,
                user.getName() + "님, " + customerName + "의 TX TMS에 초대되었습니다. 아래 링크에서 7일 안에 이름과 "
                        + "비밀번호를 설정하세요.\n" + link);
        return expiresAt;
    }

    /** Expiry of each user's currently usable invitation link (users without one are absent). */
    @Transactional(readOnly = true)
    public Map<Long, Instant> usableExpiries(Collection<Long> userIds) {
        Map<Long, Instant> result = new HashMap<>();
        if (userIds.isEmpty()) {
            return result;
        }
        Instant now = clock.instant();
        for (UserInvitation i : invitations.findByUserIdIn(userIds)) {
            if (i.isUsable(now)) {
                result.merge(i.getUserId(), i.getExpiresAt(), (a, b) -> a.isAfter(b) ? a : b);
            }
        }
        return result;
    }
}
