"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverFormError } from "@/shared/api";
import { Banner, ErrorDetails, Field, Input, Modal, Select, toast } from "@/shared/ui";
import type { Customer } from "@/entities/customer";
import type { Project, ProjectRole } from "@/entities/project";
import { memberApi } from "@/entities/user";
import { isExternalEmail } from "../model/form-checks";
import { INVITE_DONE_TOAST, inviteRoleOptions, inviteStep, normalizeEmail, type InviteForm } from "../model/invite-form";
import { invalidateUserData } from "../model/invalidate";
import { useServerError } from "../model/server-error";
import styles from "./admin.module.css";

export interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Pick<Customer, "id" | "domain" | "approvalEnabled">;
  projects: Project[];
  /** Initially selected project (the current one). */
  projectId: number | null;
}

/** 사용자 초대 (reference J:143 + external domain confirmation J:289). */
export function InviteUserDialog(props: InviteUserDialogProps) {
  if (!props.open) return null;
  return <InviteBody {...props} />;
}

function InviteBody({ onClose, customer, projects, projectId }: InviteUserDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [form, setForm] = useState<InviteForm>(() => ({
    email: "",
    name: "",
    projectId: String(projectId ?? projects[0]?.id ?? ""),
    role: "REQUESTER",
  }));
  /** Email the admin confirmed as an external address (a changed email asks again). */
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const server = useServerError("초대하지 못했습니다");
  const set = (patch: Partial<InviteForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const step = inviteStep(form, customer.domain, confirmedEmail);
    if (step.kind === "ask") {
      setConfirmedEmail(step.confirmedEmail);
      toast(step.message);
      return false;
    }
    if (step.kind === "invalid") {
      toast(step.message);
      return false;
    }
    server.clear();
    try {
      await memberApi.invite(customer.id, step.body);
    } catch (error) {
      // The server decides what is external: a refusal is the confirmation step, the next click resends.
      if (serverFormError(error, "").code === "EXTERNAL_DOMAIN_CONFIRM_REQUIRED") {
        setConfirmedEmail(normalizeEmail(form.email));
      }
      return server.fail(error);
    }
    await invalidateUserData(client);
    toast(INVITE_DONE_TOAST);
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="사용자 초대" okLabel="초대 링크 생성" onOk={submit}>
      <Field label="이메일" required htmlFor={`${id}-email`} error={server.field("email")}>
        <Input
          id={`${id}-email`}
          type="text"
          inputMode="email"
          autoComplete="off"
          placeholder="name@company.com"
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </Field>
      <Field label="이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input id={`${id}-name`} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
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
          {inviteRoleOptions(customer.approvalEnabled).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <p className={styles.small}>회사 외부 도메인 이메일도 초대할 수 있습니다.</p>
      {isExternalEmail(form.email, customer.domain) ? (
        <Banner tone="danger">외부 도메인 이메일입니다. 초대 대상을 확인하세요.</Banner>
      ) : null}
      <p className={styles.small}>외부 도메인 초대는 경고 확인 후 진행됩니다.</p>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
