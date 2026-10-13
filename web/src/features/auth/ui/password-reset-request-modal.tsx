"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Field, Input, Modal } from "@/shared/common";
import { authApi } from "../api/auth-api";
import { passwordResetRequestSchema, type PasswordResetRequestValues } from "../model/schemas";

/** Same answer for every email — the response never reveals whether an account exists. */
export const PASSWORD_RESET_REQUESTED_MESSAGE = "등록된 계정이면 재설정 안내가 생성됩니다";

const FORM_ID = "password-reset-request-form";

export interface PasswordResetRequestModalProps {
  open: boolean;
  onClose: () => void;
}

/** `POST /api/auth/password-reset-requests` (always 202). The link is delivered by mail only. */
export function PasswordResetRequestModal({ open, onClose }: PasswordResetRequestModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!open) reset({ email: "" });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.requestPasswordReset(values);
      onClose();
      toast(PASSWORD_RESET_REQUESTED_MESSAGE);
    } catch (error) {
      toast(isApiError(error) ? error.message : "요청을 처리하지 못했습니다");
    }
  });

  return (
    <Modal
      open={open}
      title="비밀번호 재설정"
      onClose={onClose}
      okLabel="재설정 링크 생성"
      okFormId={FORM_ID}
      busy={isSubmitting}
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate>
        <Field label="이메일" htmlFor="reset-email" required error={errors.email?.message}>
          <Input
            id="reset-email"
            type="text"
            autoComplete="email"
            inputMode="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "reset-email-error" : undefined}
            {...register("email")}
          />
        </Field>
      </form>
    </Modal>
  );
}
