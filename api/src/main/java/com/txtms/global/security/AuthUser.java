package com.txtms.global.security;

/** Authenticated principal carried by the access token: the user and the server session. */
public record AuthUser(long userId, long sessionId) {
}
