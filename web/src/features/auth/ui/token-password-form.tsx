"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isApiError } from "@/shared/api";
import { Button, Field, Input, toast } from "@/shared/ui";
import type { AuthTokenKind } from "@/entities/me";
import { authApi } from "../api/auth-api";
import {
  PASSWORD_POLICY_TEXT,
  passwordResetSchema,
  tokenPasswordSchema,
  type TokenPasswordValues,
} from "../model/schemas";
import { applySession } from "../model/session";
import styles from "./auth-form.module.css";

export interface TokenPasswordFormProps {
  token: string;
  kind: AuthTokenKind;
  defaultName: string;
  onSuccess: () => void;
}

/**
 * Invitation acceptance / password reset (`POST /api/auth/tokens/{token}/password`).
 * The name is editable only for invitations; reset keeps the account name.
 */
export function TokenPasswordForm({ token, kind, defaultName, onSuccess }: TokenPasswordFormProps) {
  const isReset = kind === "PASSWORD_RESET";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TokenPasswordValues>({
    // Reset keeps the account name: the disabled name input is not submitted.
    resolver: zodResolver(isReset ? passwordResetSchema : tokenPasswordSchema) as never,
    defaultValues: { name: defaultName, password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      applySession(
        await authApi.setTokenPassword(token, { name: values.name ?? defaultName, password: values.password }),
      );
      onSuccess();
    } catch (error) {
      toast(isApiError(error) ? error.message : "비밀번호를 설정하지 못했습니다");
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="비밀번호 설정">
      <Field label="이름" htmlFor="invite-name" error={errors.name?.message}>
        <Input
          id="invite-name"
          autoComplete="name"
          disabled={isReset}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "invite-name-error" : undefined}
          {...register("name")}
        />
      </Field>
      <Field label="비밀번호" htmlFor="invite-password" error={errors.password?.message}>
        <Input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "invite-password-error invite-password-policy" : "invite-password-policy"}
          {...register("password")}
        />
        <p id="invite-password-policy" className={styles.policy}>
          {PASSWORD_POLICY_TEXT}
        </p>
      </Field>
      <Button type="submit" variant="pri" disabled={isSubmitting}>
        비밀번호 설정
      </Button>
    </form>
  );
}
