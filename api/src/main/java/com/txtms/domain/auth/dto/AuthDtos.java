package com.txtms.domain.auth.dto;

import com.txtms.domain.auth.service.TokenKind;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request and response bodies of the authentication endpoints. */
public final class AuthDtos {

    private AuthDtos() {
    }

    /**
     * Length caps keep oversized input away from the failure counter (its key column holds 255 characters) and from
     * the password hash; an over-long value can never belong to an account, so it is rejected as invalid input.
     */
    public record LoginRequest(
            @NotBlank(message = "이메일을 입력하세요") @Size(max = 255, message = "이메일은 255자 이하로 입력하세요") String email,
            @NotBlank(message = "비밀번호를 입력하세요") @Size(max = 1000, message = "비밀번호를 확인하세요") String password,
            Boolean remember) {

        /** "로그인 유지" is optional; a missing value is a normal session (Jackson 3 rejects missing primitives). */
        public boolean rememberMe() {
            return Boolean.TRUE.equals(remember);
        }
    }

    public record DemoLoginRequest(@NotNull(message = "체험 계정을 선택하세요") Long userId) {
    }

    public record LoginResponse(String accessToken, MeResponse me) {
    }

    public record DemoPersona(long userId, String name, String roleLabel, String description, String avatarColor) {
    }

    public record PasswordResetRequest(
            @NotBlank(message = "이메일을 입력하세요") @Size(max = 255, message = "이메일은 255자 이하로 입력하세요") String email) {
    }

    public record TokenInfo(TokenKind kind, boolean valid, String email, String name) {
    }

    public record TokenPasswordRequest(String name,
            @NotBlank(message = "비밀번호를 입력하세요") @Size(max = 1000, message = "비밀번호는 72바이트 이하여야 합니다")
            String password) {
    }

    public record UpdateMeRequest(
            @NotBlank(message = "이름을 입력하세요") @Size(max = 50, message = "이름은 50자 이하로 입력하세요") String name,
            @Size(max = 100, message = "소속은 100자 이하로 입력하세요") String dept) {
    }

    /** Self-service password change. The 1,000-character caps only keep huge input away from the hash check. */
    public record ChangePasswordRequest(
            @NotBlank(message = "현재 비밀번호를 입력하세요") @Size(max = 1000, message = "현재 비밀번호가 일치하지 않습니다")
            String currentPassword,
            @NotBlank(message = "새 비밀번호를 입력하세요") @Size(max = 1000, message = "비밀번호는 72바이트 이하여야 합니다")
            String newPassword) {
    }
}
