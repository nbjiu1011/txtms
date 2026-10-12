"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isApiError } from "@/shared/api";
import { cn } from "@/shared/lib";
import { Button, Field, Input, Select, toast } from "@/shared/ui";
import type { SignupCustomer, SignupRole } from "@/entities/me";
import { authApi } from "../api/auth-api";
import { PASSWORD_POLICY_TEXT } from "../model/schemas";
import { applySession } from "../model/session";
import {
  EMPTY_SIGNUP,
  SIGNUP_ROLES,
  signupBody,
  signupProblem,
  signupRoleDef,
  signupSchema,
  type SignupValues,
} from "../model/signup";
import styles from "./signup-form.module.css";

const FORM_FIELDS = new Set<string>(Object.keys(EMPTY_SIGNUP));

export interface SignupFormProps {
  customers: SignupCustomer[];
  /** Called after the new account's session is stored. */
  onSuccess: (name: string) => void;
}

/** Temporary sign-up (`POST /api/auth/signup`): role, where the role applies, then the account. */
export function SignupForm({ customers, onSuccess }: SignupFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: EMPTY_SIGNUP,
  });

  const role = useWatch({ control, name: "role" }) as SignupRole | "";
  const customerId = useWatch({ control, name: "customerId" });
  const projectId = useWatch({ control, name: "projectId" });
  const scope = role ? signupRoleDef(role).scope : null;
  const customer = customers.find((c) => String(c.id) === customerId);
  const project = customer?.projects.find((p) => String(p.id) === projectId);

  const onSubmit = handleSubmit(async (values) => {
    const problem = signupProblem(values, customers);
    if (problem) {
      setError(problem.field, { message: problem.message }, { shouldFocus: true });
      return;
    }
    try {
      applySession(await authApi.signup(signupBody(values)));
      onSuccess(values.name.trim());
    } catch (error) {
      if (!isApiError(error)) {
        toast("가입하지 못했습니다");
        return;
      }
      const fields = error.fieldErrors.filter((f) => FORM_FIELDS.has(f.field));
      fields.forEach((f) => setError(f.field as keyof SignupValues, { message: f.message }));
      if (error.code === "DUPLICATE") setError("email", { message: error.message });
      toast(error.message);
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="임시 가입">
      <fieldset className={styles.roles} aria-describedby={errors.role ? "signup-role-error" : undefined}>
        <legend className={styles.legend}>
          <span className={styles.step}>1</span>
          역할 선택
        </legend>
        <div className={styles.roleGrid}>
          {SIGNUP_ROLES.map((def) => (
            <label key={def.role} className={cn(styles.roleCard, role === def.role && styles.on)} data-role={def.role}>
              <input
                type="radio"
                value={def.role}
                className={styles.radio}
                {...register("role", { onChange: () => clearErrors(["role", "customerId", "projectId"]) })}
              />
              <span className={styles.roleName}>{def.label}</span>
              <span className={styles.roleSummary}>{def.summary}</span>
              <span className={styles.roleScope}>
                {def.scope === "project" ? "프로젝트 역할" : def.scope === "customer" ? "고객사 단위" : "솔루션 전체"}
              </span>
            </label>
          ))}
        </div>
        {errors.role ? (
          <p id="signup-role-error" className={styles.error} role="alert">
            {errors.role.message}
          </p>
        ) : null}
      </fieldset>

      {scope && scope !== "none" ? (
        <fieldset className={styles.section}>
          <legend className={styles.legend}>
            <span className={styles.step}>2</span>
            {scope === "project" ? "고객사 · 프로젝트" : "고객사"}
          </legend>
          <div className={styles.row}>
            <Field label="고객사" htmlFor="signup-customer" required error={errors.customerId?.message}>
              <Select
                id="signup-customer"
                aria-invalid={errors.customerId ? true : undefined}
                {...register("customerId", {
                  onChange: () => {
                    setValue("projectId", "");
                    clearErrors(["customerId", "projectId", "role"]);
                  },
                })}
              >
                <option value="">고객사 선택</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {role === "APPROVER" && !c.approvalEnabled ? " (승인 단계 미사용)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {scope === "project" ? (
              <Field
                label="프로젝트"
                htmlFor="signup-project"
                required
                error={errors.projectId?.message}
                hint={customer && customer.projects.length === 0 ? "이 고객사에는 사용 중인 프로젝트가 없습니다" : undefined}
              >
                <Select
                  id="signup-project"
                  disabled={!customer}
                  aria-invalid={errors.projectId ? true : undefined}
                  {...register("projectId", { onChange: () => clearErrors("projectId") })}
                >
                  <option value="">{customer ? "프로젝트 선택" : "고객사를 먼저 고르세요"}</option>
                  {customer?.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          {role === "LEAD_REVIEWER" && project ? (
            <p className={styles.note}>
              {project.leadName
                ? `가입하면 이 프로젝트의 대표 검수자가 ${project.leadName}에서 가입자로 바뀝니다. ${project.leadName}은(는) 검수자로 남습니다.`
                : "가입하면 이 프로젝트의 대표 검수자가 됩니다."}
            </p>
          ) : null}
          {role === "APPROVER" && customer && !customer.approvalEnabled ? (
            <p className={styles.note}>이 고객사는 승인 단계를 쓰지 않습니다. 승인 단계를 쓰는 고객사를 고르세요.</p>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className={styles.section}>
        <legend className={styles.legend}>
          <span className={styles.step}>{scope && scope !== "none" ? 3 : 2}</span>
          계정
        </legend>
        <div className={styles.row}>
          <Field label="이름" htmlFor="signup-name" required error={errors.name?.message}>
            <Input
              id="signup-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
            />
          </Field>
          <Field label="이메일" htmlFor="signup-email" required error={errors.email?.message}>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
          </Field>
        </div>
        <Field
          label="비밀번호"
          htmlFor="signup-password"
          required
          hint={PASSWORD_POLICY_TEXT}
          error={errors.password?.message}
        >
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="signup-password-hint"
            {...register("password")}
          />
        </Field>
      </fieldset>

      <div className={styles.actions}>
        <Button type="submit" variant="pri" disabled={isSubmitting}>
          {isSubmitting ? "가입하는 중…" : "가입하고 시작하기"}
        </Button>
        <span className={styles.disclaimer}>개발 서버 전용 임시 계정입니다. 운영 서버에는 가입 기능이 없습니다.</span>
      </div>
    </form>
  );
}
