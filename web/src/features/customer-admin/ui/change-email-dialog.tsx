"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverFormError } from "@/shared/api";
import { Banner, ErrorDetails, Field, Input, Modal, toast } from "@/shared/ui";
import { memberApi, type Member } from "@/entities/user";
import { isEmailFormat, isExternalEmail } from "@/shared/lib";
import { EMAIL_CHANGE_EXTERNAL_TOAST } from "@/entities/user";
import { normalizeEmail } from "../model/invite-form";
import { invalidateUserData } from "../model/invalidate";
import { useServerError } from "@/shared/ui";

/** An accepted user's new address takes effect only after the user opens the link mailed to it. */
export const EMAIL_CHANGE_REQUESTED_TOAST = "새 주소로 확인 메일을 보냈습니다. 사용자가 확인하면 변경됩니다";
export const EMAIL_CHANGE_CANCELLED_TOAST = "대기 중인 이메일 변경을 취소했습니다";

export interface ChangeEmailDialogProps {
  open: boolean;
  onClose: () => void;
  customer: { id: number; domain: string };
  member: Member | null;
}

/** 사용자 이메일 변경 (reference J:239; external addresses need a second 저장 like the invitation). */
export function ChangeEmailDialog(props: ChangeEmailDialogProps) {
  if (!props.open || !props.member) return null;
  return <ChangeEmailBody {...props} member={props.member} />;
}

function ChangeEmailBody({ onClose, customer, member }: ChangeEmailDialogProps & { member: Member }) {
  const id = useId();
  const client = useQueryClient();
  const [email, setEmail] = useState(member.user.email);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const server = useServerError("이메일을 바꾸지 못했습니다");
  const value = normalizeEmail(email);
  const external = isExternalEmail(value, customer.domain) && value !== member.user.email.toLowerCase();

  const pendingEmail = member.pending ? null : (member.pendingEmail ?? null);
  const current = value === member.user.email.toLowerCase();

  const submit = async () => {
    if (!isEmailFormat(value)) {
      toast("이메일 형식 또는 중복을 확인하세요");
      return false;
    }
    // the current address changes nothing, except that it cancels a change awaiting confirmation
    if (current && !pendingEmail) return undefined;
    if (external && confirmedEmail !== value) {
      setConfirmedEmail(value);
      toast(EMAIL_CHANGE_EXTERNAL_TOAST);
      return false;
    }
    server.clear();
    try {
      await memberApi.changeEmail(customer.id, member.user.id, value, confirmedEmail === value);
    } catch (error) {
      if (serverFormError(error, "").code === "EXTERNAL_DOMAIN_CONFIRM_REQUIRED") setConfirmedEmail(value);
      return server.fail(error);
    }
    await invalidateUserData(client);
    if (current) toast(EMAIL_CHANGE_CANCELLED_TOAST);
    else if (!member.pending) toast(EMAIL_CHANGE_REQUESTED_TOAST);
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="사용자 이메일 변경" okLabel="저장" onOk={submit}>
      <Field label="이메일" required htmlFor={`${id}-email`} error={server.field("email")}>
        <Input id={`${id}-email`} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {pendingEmail ? (
        <Banner tone="wait">
          변경 확인 대기: {pendingEmail}. 현재 주소로 저장하면 대기 중인 변경을 취소합니다.
        </Banner>
      ) : null}
      {external ? <Banner tone="danger">외부 도메인 이메일입니다. 주소를 확인하세요.</Banner> : null}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
