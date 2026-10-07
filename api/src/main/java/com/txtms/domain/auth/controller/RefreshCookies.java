package com.txtms.domain.auth.controller;

import java.time.Duration;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.txtms.global.config.AppProperties;

/** The refresh-token cookie: httpOnly, SameSite=Strict, Path=/api/auth, Secure per configuration. */
@Component
public class RefreshCookies {

    public static final String PATH = "/api/auth";

    private final AppProperties properties;

    public RefreshCookies(AppProperties properties) {
        this.properties = properties;
    }

    public String name() {
        return properties.auth().refreshCookieName();
    }

    /** "Remember me" sessions get a persistent cookie; others a browser-session cookie. */
    public ResponseCookie issue(String token, boolean remember) {
        ResponseCookie.ResponseCookieBuilder builder = base(token);
        if (remember) {
            builder.maxAge(properties.session().rememberDuration());
        }
        return builder.build();
    }

    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(name(), value)
                .httpOnly(true)
                .secure(properties.auth().refreshCookieSecure())
                .sameSite("Strict")
                .path(PATH);
    }
}
