package com.txtms.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PasswordPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {"abcd1234", "abcdefg!", "1234567!", "Txtms!2026", "비밀번호는길게1"})
    void acceptsEightOrMoreWithTwoKinds(String password) {
        assertThat(PasswordPolicy.satisfied(password)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"abcdefgh", "ABCDefgh", "12345678", "!@#$%^&*", "abc123!", ""})
    void rejectsSingleKindOrShort(String password) {
        assertThat(PasswordPolicy.satisfied(password)).isFalse();
    }

    @Test
    void rejectsNull() {
        assertThat(PasswordPolicy.satisfied(null)).isFalse();
    }

    @Test
    void upperAndLowerCaseCountAsOneKind() {
        assertThat(PasswordPolicy.satisfied("AbCdEfGh")).isFalse();
    }

    @Test
    void flagsPasswordsBeyondBcryptLimit() {
        assertThat(PasswordPolicy.tooLong("a1".repeat(36))).isFalse();
        assertThat(PasswordPolicy.tooLong("a1".repeat(36) + "x")).isTrue();
        assertThat(PasswordPolicy.tooLong("가".repeat(25))).isTrue();
    }
}
