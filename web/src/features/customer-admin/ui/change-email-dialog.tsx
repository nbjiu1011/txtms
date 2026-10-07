"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverFormError } from "@/shared/api";
import { Banner, ErrorDetails, Field, Input, Modal, toast } from "@/shared/ui";
import { memberApi, type Member } from "@/entities/user";
import { isEmailFormat, isExternalEmail } from "@/shared/lib";
import { EXTERNAL_DOMAIN_TOAST } from "@/entities/user";
import { normalizeEmail } from "../model/invite-form";
import { invalidateUserData } from "../model/invalidate";
import { useServerError } from "@/shared/ui";

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

  const submit = async () => {
    if (!isEmailFormat(value)) {
      toast("이메일 형식 또는 중복을 확인하세요");
      return false;
    }
    if (value === member.user.email.toLowerCase()) return undefined;
    if (external && confirmedEmail !== value) {
      setConfirmedEmail(value);
      toast(EXTERNAL_DOMAIN_TOAST);
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
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="사용자 이메일 변경" okLabel="저장" onOk={submit}>
      <Field label="이메일" required htmlFor={`${id}-email`} error={server.field("email")}>
        <Input id={`${id}-email`} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {external ? <Banner tone="danger">외부 도메인 이메일입니다. 주소를 확인하세요.</Banner> : null}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
