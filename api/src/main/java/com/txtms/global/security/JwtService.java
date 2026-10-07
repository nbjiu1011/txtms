package com.txtms.global.security;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.txtms.global.config.AppProperties;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** Issues and verifies short-lived HS256 access tokens ({@code sub} = user id, {@code sid} = session id). */
@Component
public class JwtService {

    private static final String SESSION_CLAIM = "sid";

    private final SecretKey key;
    private final Duration ttl;
    private final Clock clock;
    private final JwtParser parser;

    public JwtService(AppProperties properties, Clock clock) {
        this.key = Keys.hmacShaKeyFor(secretBytes(properties.jwt().secret()));
        this.ttl = properties.jwt().accessTokenTtl();
        this.clock = clock;
        this.parser = Jwts.parser()
                .verifyWith(key)
                .clock(() -> Date.from(clock.instant()))
                .build();
    }

    public String issue(long userId, long sessionId) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(Long.toString(userId))
                .claim(SESSION_CLAIM, sessionId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Empty when the token is malformed, tampered with or expired. */
    public Optional<AuthUser> parse(String token) {
        try {
            Claims claims = parser.parseSignedClaims(token).getPayload();
            long userId = Long.parseLong(claims.getSubject());
            Number sessionId = claims.get(SESSION_CLAIM, Number.class);
            if (sessionId == null) {
                return Optional.empty();
            }
            return Optional.of(new AuthUser(userId, sessionId.longValue()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static byte[] secretBytes(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("app.jwt.secret (JWT_SECRET) is not configured");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(secret);
        } catch (IllegalArgumentException notBase64) {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 256 bits");
        }
        return bytes;
    }
}
