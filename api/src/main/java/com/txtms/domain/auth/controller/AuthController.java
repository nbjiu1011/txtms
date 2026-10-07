package com.txtms.domain.auth.controller;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.WebUtils;

import com.txtms.domain.auth.dto.AuthDtos.DemoLoginRequest;
import com.txtms.domain.auth.dto.AuthDtos.DemoPersona;
import com.txtms.domain.auth.dto.AuthDtos.LoginRequest;
import com.txtms.domain.auth.dto.AuthDtos.LoginResponse;
import com.txtms.domain.auth.dto.AuthDtos.PasswordResetRequest;
import com.txtms.domain.auth.dto.AuthDtos.TokenInfo;
import com.txtms.domain.auth.dto.AuthDtos.TokenPasswordRequest;
import com.txtms.domain.auth.service.AuthService;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;
import com.txtms.global.exception.ErrorResponse;
import com.txtms.global.security.AuthUser;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshCookies cookies;
    private final RefreshRequestGuard refreshGuard;

    public AuthController(AuthService authService, RefreshCookies cookies, RefreshRequestGuard refreshGuard) {
        this.authService = authService;
        this.cookies = cookies;
        this.refreshGuard = refreshGuard;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return withCookie(authService.login(request.email(), request.password(), request.rememberMe()));
    }

    @GetMapping("/demo-personas")
    public List<DemoPersona> demoPersonas() {
        return authService.demoPersonas();
    }

    @PostMapping("/demo-login")
    public ResponseEntity<LoginResponse> demoLogin(@Valid @RequestBody DemoLoginRequest request) {
        return withCookie(authService.demoLogin(request.userId()));
    }

    /**
     * On failure the error body is returned and the stale cookie is removed. A cross-site call is refused first
     * ({@link RefreshRequestGuard}) and keeps the cookie.
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request) {
        refreshGuard.check(request);
        Cookie cookie = WebUtils.getCookie(request, cookies.name());
        try {
            return withCookie(authService.refresh(cookie == null ? null : cookie.getValue()));
        } catch (BusinessException e) {
            ErrorCode code = e.getCode();
            return ResponseEntity.status(code.status())
                    .header(HttpHeaders.SET_COOKIE, cookies.clear().toString())
                    .body(new ErrorResponse(code.name(), e.getMessage(), e.getFieldErrors(), e.getDetails()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthUser user) {
        authService.logout(user);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @PostMapping("/password-reset-requests")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        authService.requestPasswordReset(request.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @GetMapping("/tokens/{token}")
    public TokenInfo inspectToken(@PathVariable String token) {
        return authService.inspectToken(token);
    }

    @PostMapping("/tokens/{token}/password")
    public ResponseEntity<LoginResponse> setPassword(@PathVariable String token,
            @Valid @RequestBody TokenPasswordRequest request) {
        return withCookie(authService.completeToken(token, request.name(), request.password()));
    }

    private ResponseEntity<LoginResponse> withCookie(AuthService.LoginResult result) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.issue(result.refreshToken(), result.remember()).toString())
                .body(new LoginResponse(result.accessToken(), result.me()));
    }
}
