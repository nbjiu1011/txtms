package com.txtms.domain.auth.controller;

import java.net.URI;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.txtms.global.config.AppProperties;
import com.txtms.global.exception.BusinessException;
import com.txtms.global.exception.ErrorCode;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Cross-site request check of {@code POST /api/auth/refresh}, the only endpoint authenticated by the refresh cookie
 * alone (a body-less POST is a "simple" request a foreign page can send). SameSite=Strict keeps the cookie off
 * cross-site requests; this check also closes the same-site case (a sibling subdomain) and old browsers:
 * <ul>
 * <li>{@code Sec-Fetch-Site}: {@code same-origin} and {@code none} pass; {@code same-site} and {@code cross-site}
 * pass only from an allowed origin.</li>
 * <li>{@code Origin} (when present): must be the web origin ({@code app.web-base-url}), a configured CORS origin or
 * the API's own origin. {@code null} origins are refused.</li>
 * <li>Neither header (non-browser clients): allowed — the cookie must still be presented.</li>
 * </ul>
 * A refused call is {@code FORBIDDEN} and leaves the cookie untouched (no forced logout by a foreign page).
 */
@Component
public class RefreshRequestGuard {

    static final String REFUSED = "허용되지 않은 출처의 요청입니다";

    private final Set<String> allowedOrigins = new HashSet<>();

    public RefreshRequestGuard(AppProperties properties) {
        origin(properties.webBaseUrl()).ifPresent(allowedOrigins::add);
        properties.cors().allowedOrigins().forEach(o -> origin(o).ifPresent(allowedOrigins::add));
    }

    public void check(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        String site = request.getHeader("Sec-Fetch-Site");
        boolean originAllowed = origin != null && allowed(origin, request);
        if (site != null) {
            String s = site.trim().toLowerCase(Locale.ROOT);
            if (s.equals("same-origin") || s.equals("none")) {
                return;
            }
            if (originAllowed) {
                return;
            }
            throw refused();
        }
        if (origin != null && !originAllowed) {
            throw refused();
        }
    }

    private boolean allowed(String origin, HttpServletRequest request) {
        java.util.Optional<String> normalized = origin(origin);
        if (normalized.isEmpty()) {
            return false;
        }
        if (allowedOrigins.contains(normalized.get())) {
            return true;
        }
        String host = request.getHeader("Host");
        return host != null && normalized.get().equals(origin(request.getScheme() + "://" + host).orElse(null));
    }

    /** {@code scheme://host[:port]} in lower case, default ports dropped; empty for {@code null} or bad values. */
    static java.util.Optional<String> origin(String value) {
        if (value == null || value.isBlank() || value.trim().equalsIgnoreCase("null")) {
            return java.util.Optional.empty();
        }
        try {
            URI uri = URI.create(value.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return java.util.Optional.empty();
            }
            String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            boolean defaultPort = port == -1 || scheme.equals("http") && port == 80 || scheme.equals("https") && port == 443;
            return java.util.Optional.of(scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                    + (defaultPort ? "" : ":" + port));
        } catch (IllegalArgumentException e) {
            return java.util.Optional.empty();
        }
    }

    private static BusinessException refused() {
        return new BusinessException(ErrorCode.FORBIDDEN, REFUSED);
    }
}
