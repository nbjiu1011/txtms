"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isApiError } from "@/shared/api";
import { Field, Input, toast } from "@/shared/ui";
import { meApi, useSessionStore, type Me } from "@/entities/me";
import { profileSchema, type ProfileValues } from "../model/schema";

export interface ProfileFormProps {
  me: Me;
  /** Grid wrapper class (two columns on desktop). */
  className?: string;
}

/** Name / department of the current user, saved on change (blur or Enter) via `PATCH /api/me`. */
export function ProfileForm({ me, className }: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.name, dept: me.dept ?? "" },
  });

  const save = handleSubmit(async (values) => {
    if (!dirtyFields.name && !dirtyFields.dept) return;
    try {
      const updated = await meApi.patch({ name: values.name, dept: values.dept });
      useSessionStore.getState().setMe(updated);
      reset({ name: updated.name, dept: updated.dept ?? "" });
    } catch (error) {
      toast(isApiError(error) ? error.message : "저장하지 못했습니다");
    }
  });

  return (
    <form className={className} onSubmit={save} noValidate aria-label="프로필">
      <Field label="이름" htmlFor="profile-name" error={errors.name?.message}>
        <Input
          id="profile-name"
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          {...register("name", { onBlur: () => void save() })}
        />
      </Field>
      <Field label="소속" htmlFor="profile-dept" error={errors.dept?.message}>
        <Input id="profile-dept" autoComplete="organization" {...register("dept", { onBlur: () => void save() })} />
      </Field>
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
  );
}
