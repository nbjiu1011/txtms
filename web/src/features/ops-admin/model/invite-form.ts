import { firstMissing, isEmailFormat, isExternalEmail, normalizeEmail } from "@/shared/lib";
import type { OpsInvitation } from "@/entities/ops";
import type { ProjectRole } from "@/entities/project";
import { EXTERNAL_DOMAIN_TOAST } from "@/entities/user";

export interface OpsInviteForm {
  email: string;
  name: string;
  dept: string;
  /** Selected project id ('' = none). */
  projectId: string;
  role: ProjectRole;
}

/** 초대 링크 생성 outcome (reference J:216 + J:289): ask once for an external address, then validate. */
export type OpsInviteStep =
  | { kind: "ask"; confirmedEmail: string; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "send"; body: OpsInvitation };

export const INVITE_FORMAT_MESSAGE = "이메일 형식 또는 중복을 확인하세요";

/**
 * `admin`: the first customer admin (no project role needed). Business users need a project and role
 * (`프로젝트가 필요합니다`). The external domain confirmation is bound to the exact email entered.
 */
export function opsInviteStep(
  form: OpsInviteForm,
  ctx: { domain: string; admin: boolean },
  confirmedEmail: string,
): OpsInviteStep {
  const email = normalizeEmail(form.email);
  if (isExternalEmail(email, ctx.domain) && confirmedEmail !== email) {
    return { kind: "ask", confirmedEmail: email, message: EXTERNAL_DOMAIN_TOAST };
  }
  const missing = firstMissing([
    [form.email, "이메일"],
    [form.name, "이름"],
  ]);
  if (missing) return { kind: "invalid", message: missing };
  if (!isEmailFormat(email)) return { kind: "invalid", message: INVITE_FORMAT_MESSAGE };
  if (!ctx.admin && !form.projectId) return { kind: "invalid", message: "프로젝트가 필요합니다" };
  const withRole = !ctx.admin && form.projectId !== "";
  return {
    kind: "send",
    body: {
      email,
      name: form.name.trim(),
      dept: form.dept.trim(),
      admin: ctx.admin,
      projectId: withRole ? Number(form.projectId) : null,
      role: withRole ? form.role : null,
      externalDomainConfirmed: confirmedEmail === email,
    },
  };
}

export const INVITE_RESULT_NOTE = "7일 동안 유효합니다. 실제 메일 발송은 서버 연동 대상입니다.";
