package com.txtms.domain.auth.dto;

import com.txtms.domain.auth.service.TokenKind;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request and response bodies of the authentication endpoints. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "이메일을 입력하세요") String email,
            @NotBlank(message = "비밀번호를 입력하세요") String password,
            boolean remember) {
    }

    public record DemoLoginRequest(@NotNull(message = "체험 계정을 선택하세요") Long userId) {
    }

    public record LoginResponse(String accessToken, MeResponse me) {
    }

    public record DemoPersona(long userId, String name, String roleLabel, String description, String avatarColor) {
    }

    public record PasswordResetRequest(@NotBlank(message = "이메일을 입력하세요") String email) {
    }

    public record TokenInfo(TokenKind kind, boolean valid, String email, String name) {
    }

    public record TokenPasswordRequest(String name, @NotBlank(message = "비밀번호를 입력하세요") String password) {
    }

    public record UpdateMeRequest(
            @NotBlank(message = "이름을 입력하세요") @Size(max = 100, message = "이름은 100자 이하로 입력하세요") String name,
            @Size(max = 100, message = "소속은 100자 이하로 입력하세요") String dept) {
    }
}
