import { firstMissing, isEmailFormat, isExternalEmail, normalizeEmail } from "@/shared/lib";
import type { ProjectRole } from "@/entities/project";
import { EXTERNAL_DOMAIN_TOAST, type MemberInvite } from "@/entities/user";

export interface InviteForm {
  email: string;
  name: string;
  projectId: string;
  role: ProjectRole;
}

/**
 * Outcome of pressing 초대 링크 생성 (reference J:289 + J:143): an external address is held once per
 * entered email (`ask` → toast, remember it), then the required fields and the format are checked.
 * `send` carries whether the external domain was confirmed for this exact email.
 */
export type InviteStep =
  | { kind: "ask"; confirmedEmail: string; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "send"; body: MemberInvite };

export { normalizeEmail };

export function inviteStep(form: InviteForm, domain: string, confirmedEmail: string): InviteStep {
  const email = normalizeEmail(form.email);
  const external = isExternalEmail(email, domain);
  if (external && confirmedEmail !== email) return { kind: "ask", confirmedEmail: email, message: EXTERNAL_DOMAIN_TOAST };
  const missing = firstMissing([
    [form.email, "이메일"],
    [form.name, "이름"],
  ]);
  if (missing) return { kind: "invalid", message: missing };
  if (!isEmailFormat(email)) return { kind: "invalid", message: "이메일 형식을 확인하세요" };
  return {
    kind: "send",
    body: {
      email,
      name: form.name.trim(),
      dept: "",
      projectId: form.projectId ? Number(form.projectId) : null,
      role: form.projectId ? form.role : null,
      externalDomainConfirmed: confirmedEmail === email,
    },
  };
}

/** Role options of the invitation (승인자 only on approval customers). */
export function inviteRoleOptions(approvalEnabled: boolean): { value: ProjectRole; label: string }[] {
  const options: { value: ProjectRole; label: string }[] = [
    { value: "REQUESTER", label: "요청자" },
    { value: "REVIEWER", label: "검수자" },
  ];
  if (approvalEnabled) options.push({ value: "APPROVER", label: "승인자" });
  return options;
}

export const INVITE_DONE_TOAST = "초대 링크를 생성했습니다. 사용자 관리의 발송 대기함에서 확인하세요";
export const REISSUE_DONE_TOAST = "이전 링크를 무효화하고 7일 유효한 새 초대 링크를 생성했습니다";
