package com.txtms.global.security;

import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.txtms.global.config.AppProperties;

/**
 * Stateless API security: bearer access tokens, server sessions, and one error format. CSRF protection is not
 * needed for bearer-authenticated calls; the cookie-authenticated refresh endpoint relies on SameSite=Strict.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Endpoints reachable without an access token. */
    public static final List<String> PUBLIC_AUTH_PATHS = List.of(
            "/api/auth/login",
            "/api/auth/demo-personas",
            "/api/auth/demo-login",
            "/api/auth/refresh",
            "/api/auth/password-reset-requests",
            "/api/auth/tokens/**");

    private static final List<String> PUBLIC_INFRA_PATHS = List.of(
            "/actuator/health",
            "/error",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html");

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
            SessionValidator sessionValidator,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
        JwtAuthenticationFilter jwtFilter =
                new JwtAuthenticationFilter(jwtService, sessionValidator, resolver, PUBLIC_AUTH_PATHS);
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {
                })
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_AUTH_PATHS.toArray(String[]::new)).permitAll()
                        .requestMatchers(PUBLIC_INFRA_PATHS.toArray(String[]::new)).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> resolver.resolveException(req, res, null, e))
                        .accessDeniedHandler((req, res, e) -> resolver.resolveException(req, res, null, e)))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** The web app calls the API through its own origin; listed origins are allowed for local development. */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // CORS_ALLOWED_ORIGINS is a comma-separated environment value; an empty one must not register "" as an origin.
        List<String> origins = properties.cors().allowedOrigins().stream()
                .filter(o -> o != null && !o.isBlank())
                .map(String::trim)
                .toList();
        if (!origins.isEmpty()) {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(origins);
            config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Demo-Scan-Outcome"));
            config.setAllowCredentials(true);
            source.registerCorsConfiguration("/api/**", config);
        }
        return source;
    }
}
