"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { firstMissing, isExternalEmail, normalizeEmail } from "@/shared/lib";
import { ErrorDetails, toast } from "@/shared/ui";
import { Field, Input, Modal, Select, useServerError } from "@/shared/common";
import { opsApi, type OpsCustomer } from "@/entities/ops";
import type { Project, ProjectRole } from "@/entities/project";
import type { UserSummary } from "@/entities/user";
import { INVITE_RESULT_NOTE, opsInviteStep, type OpsInviteForm } from "../model/invite-form";
import { invalidateOps } from "../model/invalidate";
import styles from "./ops.module.css";

type SetupCustomer = Pick<OpsCustomer, "id" | "name" | "domain" | "approvalEnabled">;

export interface SeedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  customer: SetupCustomer;
  /** Users of the customer; active ones can be the lead reviewer. */
  users: UserSummary[];
}

/** 초기 프로젝트 생성 (reference `seedProject`). */
export function SeedProjectDialog(props: SeedProjectDialogProps) {
  if (!props.open) return null;
  return <SeedProjectBody {...props} />;
}

function SeedProjectBody({ onClose, customer, users }: SeedProjectDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const candidates = users.filter((u) => u.active);
  const [name, setName] = useState("");
  const [leadId, setLeadId] = useState(String(candidates[0]?.id ?? ""));
  const server = useServerError("프로젝트를 만들지 못했습니다");

  const submit = async () => {
    const missing = firstMissing([[name, "프로젝트 이름"]]);
    if (missing) return server.reject(missing, "name");
    server.clear();
    try {
      await opsApi.createProject(customer.id, { name: name.trim(), leadUserId: leadId ? Number(leadId) : null });
    } catch (error) {
      return server.fail(error);
    }
    await invalidateOps(client);
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="초기 프로젝트 생성"
      description={`${customer.name}의 업무 단위를 만듭니다. 대표 검수자는 이후 고객사 관리자가 바꿀 수 있습니다.`}
      okLabel="생성"
      onOk={submit}
    >
      <Field label="프로젝트 이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input
          id={`${id}-name`}
          placeholder="예: 고객 안내 문자"
          value={name}
          onChange={(e) => {
            server.clearField("name");
            setName(e.target.value);
          }}
        />
      </Field>
      {candidates.length ? (
        <Field label="대표 검수자" required htmlFor={`${id}-lead`} error={server.field("leadUserId")}>
          <Select id={`${id}-lead`} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {`${u.name}  ${u.dept ?? ""}`}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className={styles.smallMuted}>사용자가 없습니다. 먼저 사용자를 초대하면 대표 검수자를 지정할 수 있습니다.</p>
      )}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}

export interface SeedUserDialogProps {
  open: boolean;
  onClose: () => void;
  customer: SetupCustomer;
  /** `admin`: 첫 고객사 관리자 초대 / `member`: 초기 업무 사용자 초대. */
  mode: "admin" | "member";
  projects: Project[];
}

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "REQUESTER", label: "요청자" },
  { value: "REVIEWER", label: "검수자" },
  { value: "APPROVER", label: "승인자" },
];

/**
 * 첫 고객사 관리자 초대 / 초기 업무 사용자 초대 (reference J:216 + external domain J:289), then the
 * 초대 링크 생성 완료 result with the queued mail (the link shows unmasked only in demo mode).
 */
export function SeedUserDialog(props: SeedUserDialogProps) {
  const [result, setResult] = useState<{ email: string; body: string | null } | null>(null);
  if (result) {
    return (
      <Modal open onClose={() => { setResult(null); props.onClose(); }} title="초대 링크 생성 완료" cancelLabel="닫기">
        <p>{INVITE_RESULT_NOTE}</p>
        {result.body ? (
          <p className={styles.link}>{result.body}</p>
        ) : (
          <p className={styles.smallMuted}>{result.email}에게 보낼 초대 메일이 발송 대기함에 쌓였습니다.</p>
        )}
      </Modal>
    );
  }
  if (!props.open) return null;
  return <SeedUserBody {...props} onInvited={setResult} />;
}

function SeedUserBody({
  onClose,
  customer,
  mode,
  projects,
  onInvited,
}: SeedUserDialogProps & { onInvited: (r: { email: string; body: string | null }) => void }) {
  const id = useId();
  const client = useQueryClient();
  const admin = mode === "admin";
  const [form, setForm] = useState<OpsInviteForm>(() => ({
    email: "",
    name: "",
    dept: "",
    projectId: String(projects[0]?.id ?? ""),
    role: "REQUESTER",
  }));
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const server = useServerError("초대하지 못했습니다");
  const set = (patch: Partial<OpsInviteForm>) => {
    for (const key of Object.keys(patch)) server.clearField(key);
    setForm((f) => ({ ...f, ...patch }));
  };
  const roles = ROLE_OPTIONS.filter((r) => r.value !== "APPROVER" || customer.approvalEnabled);

  const submit = async () => {
    const step = opsInviteStep(form, { domain: customer.domain, admin }, confirmedEmail);
    if (step.kind === "ask") {
      setConfirmedEmail(step.confirmedEmail);
      toast(step.message);
      return false;
    }
    if (step.kind === "invalid") return server.reject(step.message);
    server.clear();
    let mailId: number;
    try {
      mailId = (await opsApi.invite(customer.id, step.body)).mailId;
    } catch (error) {
      // The server decides what is external: its refusal is the confirmation step, the next click resends.
      const code = (error as { code?: string }).code;
      if (code === "EXTERNAL_DOMAIN_CONFIRM_REQUIRED") setConfirmedEmail(normalizeEmail(form.email));
      return server.fail(error);
    }
    await invalidateOps(client);
    // the invitation answers with its queued mail id (contract §14.7): find that mail among the customer's newest
    const mails = await opsApi.latestMails(customer.id, 20).catch(() => null);
    const mail = mails?.content.find((m) => m.id === mailId);
    onInvited({ email: step.body.email, body: mail?.body ?? null });
    return false;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={admin ? "첫 고객사 관리자 초대" : "초기 업무 사용자 초대"}
      okLabel="초대 링크 생성"
      onOk={submit}
    >
      <Field label="이메일" required htmlFor={`${id}-email`} error={server.field("email")}>
        <Input
          id={`${id}-email`}
          type="text"
          inputMode="email"
          autoComplete="off"
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </Field>
      <Field label="이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="소속" htmlFor={`${id}-dept`} error={server.field("dept")}>
        <Input id={`${id}-dept`} value={form.dept} onChange={(e) => set({ dept: e.target.value })} />
      </Field>
      {admin ? null : projects.length ? (
        <>
          <Field label="프로젝트" htmlFor={`${id}-project`} error={server.field("projectId")}>
            <Select id={`${id}-project`} value={form.projectId} onChange={(e) => set({ projectId: e.target.value })}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="역할" htmlFor={`${id}-role`} error={server.field("role")}>
            <Select id={`${id}-role`} value={form.role} onChange={(e) => set({ role: e.target.value as ProjectRole })}>
              {roles.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <p className={styles.smallMuted}>프로젝트가 없습니다. 먼저 초기 프로젝트를 만드세요.</p>
      )}
      <p className={styles.small} role="status">
        {isExternalEmail(form.email, customer.domain) ? "외부 도메인 이메일입니다. 초대 대상을 확인하세요." : null}
      </p>
      <p className={styles.small}>외부 도메인 초대는 경고 확인 후 진행됩니다.</p>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
