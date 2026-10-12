"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { serverFormError } from "@/shared/api";
import { Button, Field, Input, toast } from "@/shared/ui";
import { meApi } from "@/entities/me";
import {
  PASSWORD_POLICY_TEXT,
  passwordChangeSchema,
  type PasswordChangeValues,
} from "../model/schemas";
import styles from "./password-change-form.module.css";

export const PASSWORD_CHANGED_MESSAGE = "비밀번호를 변경했습니다";

const EMPTY: PasswordChangeValues = { currentPassword: "", newPassword: "", newPasswordConfirm: "" };
const SERVER_FIELDS = ["currentPassword", "newPassword"] as const;

/**
 * Own password change (`PUT /api/me/password`). Field errors of the server (wrong current password, policy,
 * same password) show under their inputs; other refusals (rate limit) as a toast. The other sessions of the user
 * end on success; this one stays signed in.
 */
export function PasswordChangeForm() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await meApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      reset(EMPTY);
      toast(PASSWORD_CHANGED_MESSAGE);
    } catch (thrown) {
      const error = serverFormError(thrown, "비밀번호를 변경하지 못했습니다");
      let shown = false;
      for (const key of SERVER_FIELDS) {
        const message = error.fields[key];
        if (message) {
          setError(key, { type: "server", message }, { shouldFocus: !shown });
          shown = true;
        }
      }
      if (!shown) toast(error.message);
    }
  });

  const described = (id: string, hasError: boolean, extra?: string) =>
    [hasError ? `${id}-error` : null, extra ?? null].filter(Boolean).join(" ") || undefined;

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="비밀번호 변경">
      <Field label="현재 비밀번호" htmlFor="pw-current" error={errors.currentPassword?.message}>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={described("pw-current", !!errors.currentPassword)}
          {...register("currentPassword")}
        />
      </Field>
      <div className={styles.pair}>
        <Field label="새 비밀번호" htmlFor="pw-new" hint={PASSWORD_POLICY_TEXT} error={errors.newPassword?.message}>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby={described("pw-new", !!errors.newPassword, "pw-new-hint")}
            {...register("newPassword")}
          />
        </Field>
        <Field label="새 비밀번호 확인" htmlFor="pw-confirm" error={errors.newPasswordConfirm?.message}>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.newPasswordConfirm ? true : undefined}
            aria-describedby={described("pw-confirm", !!errors.newPasswordConfirm)}
            {...register("newPasswordConfirm")}
          />
        </Field>
      </div>
      <div className={styles.actions}>
        <Button type="submit" variant="pri" disabled={isSubmitting}>
          비밀번호 변경
        </Button>
        <span className={styles.note}>변경하면 다른 기기와 브라우저의 로그인이 모두 해제됩니다.</span>
      </div>
    </form>
  );
}
