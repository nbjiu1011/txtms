package com.txtms.global.security;

/**
 * Validates the server session behind an access token on every authenticated request (and records activity).
 * Throws {@link com.txtms.global.exception.BusinessException} when the session or account is no longer valid.
 */
public interface SessionValidator {

    void validate(AuthUser user);
}
