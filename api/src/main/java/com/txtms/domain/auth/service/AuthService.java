package com.txtms.domain.auth.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.txtms.domain.auth.dto.AuthDtos.DemoPersona;
import com.txtms.domain.auth.dto.AuthDtos.TokenInfo;
import com.txtms.domain.auth.dto.MeResponse;
import com.txtms.domain.auth.entity.EmailChange;
import com.txtms.domain.auth.entity.PasswordReset;
import com.txtms.domain.auth.entity.UserInvitation;
import com.txtms.domain.auth.entity.UserSession;
import com.txtms.domain.auth.repository.EmailChangeRepository;
import com.txtms.domain.auth.repository.PasswordResetRepository;
import com.txtms.domain.auth.repository.UserInvitationRepository;
import com.txtms.domain.customer.service.CustomerService;
import com.txtms.domain.demo.DemoPersonas;
import com.txtms.domain.mail.MailKind;
import com.txtms.domain.mail.MailSender;
import com.txtms.domain.request.service.ContentLockService;
import com.txtms.domain.user.entity.User;
import com.txtms.domain.user.service.UserService;
import com.txtms.global.audit.AuditLogService;
import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.security.AuthUser;
import com.txtms.global.security.JwtService;

/**
 * Login (email/password and demo personas), refresh, logout, password reset, invitation acceptance and email change
 * confirmation.
 */
@Service
public class AuthService {

    public static final String LOGIN_FAILED_MESSAGE = "이메일 또는 비밀번호를 확인하세요";
    public static final String INVALID_LINK_MESSAGE = "유효하지 않은 링크입니다";
    public static final String CURRENT_PASSWORD_MISMATCH_MESSAGE = "현재 비밀번호가 일치하지 않습니다";
    public static final String SAME_PASSWORD_MESSAGE = "현재 비밀번호와 다른 비밀번호를 입력하세요";
    public static final String EMAIL_INVALID_OR_DUPLICATE_MESSAGE = "이메일 형식 또는 중복을 확인하세요";

    private final UserService userService;
    private final CustomerService customerService;
    private final SessionService sessionService;
    private final LoginAttemptService loginAttempts;
    private final MeService meService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetRepository passwordResets;
    private final UserInvitationRepository invitations;
    private final EmailChangeRepository emailChanges;
    private final MailSender mailSender;
    private final ContentLockService contentLocks;
    private final Clock clock;
    private final AppProperties properties;
    private final AuditLogService audit;
    private final String dummyHash;

    public AuthService(UserService userService, CustomerService customerService, SessionService sessionService,
            LoginAttemptService loginAttempts, MeService meService, JwtService jwtService,
            PasswordEncoder passwordEncoder, PasswordResetRepository passwordResets,
            UserInvitationRepository invitations, EmailChangeRepository emailChanges, MailSender mailSender,
            ContentLockService contentLocks,
            Clock clock, AppProperties properties, AuditLogService audit) {
        this.userService = userService;
        this.customerService = customerService;
        this.sessionService = sessionService;
        this.loginAttempts = loginAttempts;
        this.meService = meService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.passwordResets = passwordResets;
        this.invitations = invitations;
        this.emailChanges = emailChanges;
        this.mailSender = mailSender;
        this.contentLocks = contentLocks;
        this.clock = clock;
        this.properties = properties;
        this.audit = audit;
        // compared against for unknown accounts so response time does not reveal whether an email exists
        this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
    }

    /** Result of a successful login: access token, refresh token for the cookie, and Me. */
    public record LoginResult(String accessToken, String refreshToken, boolean remember, MeResponse me) {
    }

    @Transactional
    public LoginResult login(String email, String password, boolean remember) {
        String normalized = email.trim().toLowerCase();
        if (loginAttempts.isLocked(normalized)) {
            throw new BusinessException(ErrorCode.RATE_LIMITED);
        }
        Optional<User> found = userService.findByEmail(normalized);
        boolean matches;
        if (found.isPresent() && found.get().getPasswordHash() != null) {
            matches = passwordEncoder.matches(password, found.get().getPasswordHash());
        } else {
            passwordEncoder.matches(password, dummyHash);
            matches = false;
        }
        if (matches && found.get().isDemo() && !properties.demo().enabled()) {
            matches = false;
        }
        if (!matches) {
            boolean locked = loginAttempts.recordFailure(normalized);
            throw locked ? new BusinessException(ErrorCode.RATE_LIMITED)
                    : new BusinessException(ErrorCode.UNAUTHENTICATED, LOGIN_FAILED_MESSAGE);
        }
        loginAttempts.clear(normalized);
        User user = found.get();
        if (!userService.canUseAccount(user)) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, SessionService.INACTIVE_MESSAGE);
        }
        return startSession(user, remember);
    }

    @Transactional(readOnly = true)
    public List<DemoPersona> demoPersonas() {
        requirePersonaLogin();
        List<DemoPersona> personas = new ArrayList<>();
        for (DemoPersonas.Persona p : DemoPersonas.LOGIN_SCREEN) {
            userService.findByEmail(p.email())
                    .filter(u -> u.isDemo() && userService.canUseAccount(u))
                    .ifPresent(u -> personas.add(new DemoPersona(u.getId(), u.getName(), p.roleLabel(),
                            p.description(), u.getAvatarColor())));
        }
        return personas;
    }

    @Transactional
    public LoginResult demoLogin(long userId) {
        requirePersonaLogin();
        User user = userService.find(userId).orElseThrow(BusinessException::notFound);
        boolean demoCustomer = user.getCustomerId() == null
                || customerService.find(user.getCustomerId()).map(c -> c.isSample()).orElse(false);
        if (!user.isDemo() || !demoCustomer) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "체험 계정만 이 방식으로 로그인할 수 있습니다");
        }
        if (!userService.canUseAccount(user)) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, SessionService.INACTIVE_MESSAGE);
        }
        return startSession(user, false);
    }

    @Transactional
    public LoginResult refresh(String refreshToken) {
        UserSession session = sessionService.refresh(refreshToken);
        User user = userService.require(session.getUserId());
        return new LoginResult(jwtService.issue(user.getId(), session.getId()), refreshToken, session.isRemember(),
                meService.build(user, session));
    }

    /** Ends the session and releases every content lock the user holds. */
    @Transactional
    public void logout(AuthUser authUser) {
        sessionService.revoke(authUser.sessionId());
        contentLocks.releaseAllOf(authUser.userId());
    }

    /**
     * Self-service password change of the signed-in user. The current password must match; wrong attempts count
     * against the same failure lock as the login of that email (so the two cannot be combined to guess more often).
     * On success every other session of the user ends and the current one stays signed in.
     *
     * @return number of other sessions that were ended
     */
    @Transactional
    public int changePassword(AuthUser authUser, String currentPassword, String newPassword) {
        User user = userService.require(authUser.userId());
        String attemptKey = user.getEmail().trim().toLowerCase();
        if (loginAttempts.isLocked(attemptKey)) {
            throw passwordCheckLocked();
        }
        String hash = user.getPasswordHash();
        if (hash == null || !passwordEncoder.matches(currentPassword, hash)) {
            if (loginAttempts.recordFailure(attemptKey)) {
                throw passwordCheckLocked();
            }
            throw BusinessException.validation("currentPassword", CURRENT_PASSWORD_MISMATCH_MESSAGE);
        }
        if (PasswordPolicy.tooLong(newPassword)) {
            throw BusinessException.validation("newPassword", PasswordPolicy.TOO_LONG_MESSAGE);
        }
        if (!PasswordPolicy.satisfied(newPassword)) {
            throw BusinessException.validation("newPassword", PasswordPolicy.MESSAGE);
        }
        if (passwordEncoder.matches(newPassword, hash)) {
            throw BusinessException.validation("newPassword", SAME_PASSWORD_MESSAGE);
        }
        Instant now = clock.instant();
        user.changePasswordHash(passwordEncoder.encode(newPassword), now);
        int ended = sessionService.revokeOthersOf(user.getId(), authUser.sessionId());
        loginAttempts.clear(attemptKey);
        audit.record(user.getId(), user.getCustomerId(), "비밀번호 변경", user.getName(),
                ended > 0 ? "다른 세션 " + ended + "개 로그아웃" : null);
        return ended;
    }

    private BusinessException passwordCheckLocked() {
        long minutes = Math.max(1, properties.auth().loginLockDuration().toMinutes());
        return new BusinessException(ErrorCode.RATE_LIMITED,
                "비밀번호 확인에 여러 번 실패해 잠시 잠겼습니다. " + minutes + "분 후 다시 시도하세요");
    }

    /** Always succeeds from the caller's point of view; only active accounts receive a reset link. */
    @Transactional
    public void requestPasswordReset(String email) {
        Optional<User> found = userService.findByEmail(email);
        if (found.isEmpty()) {
            return;
        }
        User user = found.get();
        if (!userService.canUseAccount(user) || (user.isDemo() && !properties.demo().enabled())) {
            return;
        }
        Instant now = clock.instant();
        passwordResets.findByUserId(user.getId()).forEach(r -> r.revoke(now));
        String token = OpaqueTokens.generate();
        passwordResets.save(new PasswordReset(user.getId(), OpaqueTokens.hash(token), now,
                now.plus(properties.auth().passwordResetTtl())));
        String link = properties.webBaseUrl() + "/reset/" + token;
        mailSender.send(MailKind.PASSWORD_RESET, user.getCustomerId(), user.getEmail(), "TX TMS 비밀번호 재설정",
                user.getName() + "님, 아래 링크에서 1시간 안에 새 비밀번호를 설정하세요.\n" + link);
    }

    @Transactional(readOnly = true)
    public TokenInfo inspectToken(String token) {
        Instant now = clock.instant();
        String hash = OpaqueTokens.hash(token);
        Optional<UserInvitation> invitation = invitations.findByTokenHash(hash);
        if (invitation.isPresent()) {
            User user = userService.find(invitation.get().getUserId()).orElse(null);
            boolean valid = user != null && invitation.get().isUsable(now) && user.isPending();
            return valid ? new TokenInfo(TokenKind.INVITATION, true, user.getEmail(), user.getName())
                    : new TokenInfo(TokenKind.INVITATION, false, null, null);
        }
        Optional<PasswordReset> reset = passwordResets.findByTokenHash(hash);
        if (reset.isPresent()) {
            User user = userService.find(reset.get().getUserId()).orElse(null);
            boolean valid = user != null && reset.get().isUsable(now) && userService.canUseAccount(user);
            return valid ? new TokenInfo(TokenKind.PASSWORD_RESET, true, user.getEmail(), user.getName())
                    : new TokenInfo(TokenKind.PASSWORD_RESET, false, null, null);
        }
        Optional<EmailChange> change = emailChanges.findByTokenHash(hash);
        if (change.isPresent()) {
            User user = userService.find(change.get().getUserId()).orElse(null);
            boolean valid = user != null && change.get().isUsable(now) && userService.canUseAccount(user);
            return valid ? new TokenInfo(TokenKind.EMAIL_CHANGE, true, change.get().getNewEmail(), user.getName())
                    : new TokenInfo(TokenKind.EMAIL_CHANGE, false, null, null);
        }
        return new TokenInfo(null, false, null, null);
    }

    /**
     * Invitation: sets name and password and activates the account. Reset: sets the password. Then logs in. The token
     * row is read under a write lock so a link is used once even when submitted twice at the same time.
     */
    @Transactional
    public LoginResult completeToken(String token, String name, String password) {
        Instant now = clock.instant();
        String hash = OpaqueTokens.hash(token);
        Optional<UserInvitation> invitation = invitations.lockByTokenHash(hash);
        if (invitation.isPresent()) {
            User user = userService.find(invitation.get().getUserId())
                    .filter(u -> invitation.get().isUsable(now) && u.isPending())
                    .orElseThrow(AuthService::invalidLink);
            if (name == null || name.isBlank()) {
                throw BusinessException.validation("name", "이름을 입력하세요");
            }
            if (name.trim().length() > 100) {
                throw BusinessException.validation("name", "이름은 100자 이하로 입력하세요");
            }
            checkPassword(password);
            user.activateFromInvitation(name.trim(), passwordEncoder.encode(password), now);
            invitation.get().markUsed(now);
            if (!userService.canUseAccount(user)) {
                throw new BusinessException(ErrorCode.UNAUTHENTICATED, SessionService.INACTIVE_MESSAGE);
            }
            return startSession(user, false);
        }
        PasswordReset reset = passwordResets.lockByTokenHash(hash)
                .filter(r -> r.isUsable(now))
                .orElseThrow(AuthService::invalidLink);
        User user = userService.find(reset.getUserId())
                .filter(userService::canUseAccount)
                .orElseThrow(AuthService::invalidLink);
        checkPassword(password);
        user.changePasswordHash(passwordEncoder.encode(password), now);
        reset.markUsed(now);
        sessionService.revokeAllOf(user.getId());
        loginAttempts.clear(user.getEmail());
        return startSession(user, false);
    }

    /**
     * Applies a confirmed email change: the user's sign-in email becomes the new address and every session of the
     * user ends (sign in again with the new address). The token row is read under a write lock so a link is used
     * once. An address another account took in the meantime is {@code DUPLICATE}. Audited with the user as actor.
     */
    @Transactional
    public void confirmEmailChange(String token) {
        Instant now = clock.instant();
        EmailChange change = emailChanges.lockByTokenHash(OpaqueTokens.hash(token))
                .filter(c -> c.isUsable(now))
                .orElseThrow(AuthService::invalidLink);
        User user = userService.find(change.getUserId())
                .filter(userService::canUseAccount)
                .orElseThrow(AuthService::invalidLink);
        String before = user.getEmail();
        String after = change.getNewEmail();
        if (userService.findByEmail(after).filter(u -> !u.getId().equals(user.getId())).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE, EMAIL_INVALID_OR_DUPLICATE_MESSAGE);
        }
        change.markUsed(now);
        if (!after.equals(before)) {
            userService.changeEmail(user, after, now, EMAIL_INVALID_OR_DUPLICATE_MESSAGE);
        }
        sessionService.revokeAllOf(user.getId());
        audit.record(user.getId(), user.getCustomerId(), "사용자 이메일 변경", user.getName(), before + " → " + after);
    }

    LoginResult startSession(User user, boolean remember) {
        // only persona login (demo mode + persona-login-enabled) makes demo sessions with the persona switcher
        boolean demoSession = user.isDemo() && properties.demo().personaLoginAvailable();
        SessionService.Created created = sessionService.create(user, remember, demoSession);
        String accessToken = jwtService.issue(user.getId(), created.session().getId());
        return new LoginResult(accessToken, created.refreshToken(), remember,
                meService.build(user, created.session()));
    }

    /** Persona list and demo-login exist only with demo mode and persona login switched on. */
    private void requirePersonaLogin() {
        if (!properties.demo().personaLoginAvailable()) {
            throw BusinessException.notFound();
        }
    }

    private static void checkPassword(String password) {
        if (PasswordPolicy.tooLong(password)) {
            throw BusinessException.validation("password", PasswordPolicy.TOO_LONG_MESSAGE);
        }
        if (!PasswordPolicy.satisfied(password)) {
            throw BusinessException.validation("password", PasswordPolicy.MESSAGE);
        }
    }

    private static BusinessException invalidLink() {
        return new BusinessException(ErrorCode.VALIDATION_FAILED, INVALID_LINK_MESSAGE);
    }
}
