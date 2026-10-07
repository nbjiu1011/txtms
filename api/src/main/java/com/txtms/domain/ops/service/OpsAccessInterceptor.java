package com.txtms.domain.ops.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.txtms.global.security.AuthUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Declarative operator check for every handler under {@code /api/ops/**} (registered by {@link OpsWebConfig}), so a
 * new operator endpoint cannot forget it. Services check again through {@link OperatorAccess}.
 */
@Component
public class OpsAccessInterceptor implements HandlerInterceptor {

    private final OperatorAccess access;

    public OpsAccessInterceptor(OperatorAccess access) {
        this.access = access;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        AuthUser auth = authentication != null && authentication.getPrincipal() instanceof AuthUser a ? a : null;
        String message = request.getRequestURI().endsWith("/api/ops/sample-reset") ? OperatorAccess.RESET_REQUIRED
                : OperatorAccess.OPERATOR_REQUIRED;
        access.require(auth, message);
        return true;
    }
}
