"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Button, Checkbox, Field, Input } from "@/shared/common";
import { authApi } from "../api/auth-api";
import { loginSchema, type LoginValues } from "../model/schemas";
import { applySession } from "../model/session";
import { PasswordResetRequestModal } from "./password-reset-request-modal";
import styles from "./auth-form.module.css";

export interface LoginFormProps {
  /** Called after the session is stored. */
  onSuccess: () => void;
}

/** Email/password login (`POST /api/auth/login`) with "로그인 유지" and the reset-request entry. */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const [resetOpen, setResetOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      applySession(await authApi.login(values));
      onSuccess();
    } catch (error) {
      toast(isApiError(error) ? error.message : "로그인하지 못했습니다");
    }
  });

  return (
    <>
      <h2 className={styles.title}>로그인</h2>
      <p className={styles.lead}>초대받은 회사 이메일로 로그인합니다.</p>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="로그인">
        <Field label="이메일" htmlFor="lg-e" error={errors.email?.message}>
          <Input
            id="lg-e"
            placeholder="name@company.com"
            autoComplete="username"
            inputMode="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "lg-e-error" : undefined}
            {...register("email")}
          />
        </Field>
        <Field label="비밀번호" htmlFor="lg-p" error={errors.password?.message}>
          <Input
            id="lg-p"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "lg-p-error" : undefined}
            {...register("password")}
          />
        </Field>
        <Controller
          control={control}
          name="remember"
          render={({ field }) => (
            <Checkbox
              id="lg-remember"
              label="로그인 유지 (최대 14일)"
              labelClassName={styles.remember}
              name={field.name}
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
        <div className={styles.row}>
          <Button type="submit" variant="pri" disabled={isSubmitting}>
            로그인
          </Button>
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            비밀번호 재설정
          </Button>
        </div>
      </form>
      <PasswordResetRequestModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </>
  );
}
