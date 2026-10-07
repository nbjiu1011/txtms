package com.txtms.global.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Authenticates {@code Authorization: Bearer} access tokens and validates the server session on every request.
 * Failures are rendered by the global exception handler. Public auth endpoints ignore the header so a stale token
 * never blocks login or refresh.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";
    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    private final JwtService jwtService;
    private final SessionValidator sessionValidator;
    private final HandlerExceptionResolver resolver;
    private final List<String> publicPaths;

    public JwtAuthenticationFilter(JwtService jwtService, SessionValidator sessionValidator,
            HandlerExceptionResolver resolver, List<String> publicPaths) {
        this.jwtService = jwtService;
        this.sessionValidator = sessionValidator;
        this.resolver = resolver;
        this.publicPaths = publicPaths;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return publicPaths.stream().anyMatch(p -> MATCHER.match(p, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            chain.doFilter(request, response);
            return;
        }
        Optional<AuthUser> user = jwtService.parse(header.substring(BEARER.length()).trim());
        if (user.isEmpty()) {
            resolver.resolveException(request, response, null, new BusinessException(ErrorCode.UNAUTHENTICATED));
            return;
        }
        try {
            sessionValidator.validate(user.get());
        } catch (BusinessException e) {
            resolver.resolveException(request, response, null, e);
            return;
        }
        UsernamePasswordAuthenticationToken authentication =
                UsernamePasswordAuthenticationToken.authenticated(user.get(), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
