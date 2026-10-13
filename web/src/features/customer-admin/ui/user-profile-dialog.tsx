"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, toast } from "@/shared/ui";
import { Field, Input, Modal, useServerError } from "@/shared/common";
import { memberApi, type Member } from "@/entities/user";
import { invalidateUserData } from "../model/invalidate";

export interface UserProfileDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  member: Member | null;
}

/** 사용자 정보 수정 — name and department (contract §25; the email has its own dialog). */
export function UserProfileDialog(props: UserProfileDialogProps) {
  if (!props.open || !props.member) return null;
  return <UserProfileBody {...props} member={props.member} />;
}

function UserProfileBody({ onClose, customerId, member }: UserProfileDialogProps & { member: Member }) {
  const id = useId();
  const client = useQueryClient();
  const [name, setName] = useState(member.user.name);
  const [dept, setDept] = useState(member.user.dept ?? "");
  const server = useServerError("사용자 정보를 저장하지 못했습니다");

  const submit = async () => {
    if (!name.trim()) {
      toast("이름을(를) 입력하세요");
      return false;
    }
    if (name.trim() === member.user.name && dept.trim() === (member.user.dept ?? "")) return undefined;
    server.clear();
    try {
      await memberApi.updateProfile(customerId, member.user.id, { name: name.trim(), dept: dept.trim() });
    } catch (error) {
      return server.fail(error);
    }
    await invalidateUserData(client);
    toast("사용자 정보를 저장했습니다");
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="사용자 정보 수정" okLabel="저장" onOk={submit}>
      <Field label="이름" required htmlFor={`${id}-name`} error={server.field("name")}>
        <Input id={`${id}-name`} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="소속" htmlFor={`${id}-dept`} error={server.field("dept")}>
        <Input id={`${id}-dept`} value={dept} maxLength={100} onChange={(e) => setDept(e.target.value)} />
      </Field>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}

export interface AdminRightDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
  member: Member | null;
}

/** 관리자 지정 / 관리자 해제 confirmation (contract §25); a refusal keeps the dialog open with the server's message. */
export function AdminRightDialog(props: AdminRightDialogProps) {
  if (!props.open || !props.member) return null;
  return <AdminRightBody {...props} member={props.member} />;
}

function AdminRightBody({ onClose, customerId, member }: AdminRightDialogProps & { member: Member }) {
  const client = useQueryClient();
  const grant = !member.admin;
  const server = useServerError(grant ? "관리자로 지정하지 못했습니다" : "관리자 권한을 해제하지 못했습니다");
  return (
    <Modal
      open
      onClose={onClose}
      title={grant ? "고객사 관리자로 지정할까요?" : "관리자 권한을 해제할까요?"}
      description={
        grant
          ? `${member.user.name}님이 프로젝트·변수·사용자·고객사 설정·공지를 관리할 수 있게 됩니다.`
          : `${member.user.name}님은 관리 메뉴를 더 이상 쓸 수 없습니다. 프로젝트 역할은 그대로 남습니다.`
      }
      okLabel={grant ? "관리자 지정" : "관리자 해제"}
      okVariant={grant ? "pri" : "warn"}
      onOk={async () => {
        try {
          await memberApi.setAdmin(customerId, member.user.id, grant);
        } catch (error) {
          return server.fail(error);
        }
        await invalidateUserData(client);
        toast(grant ? `${member.user.name}님을 고객사 관리자로 지정했습니다` : `${member.user.name}님의 관리자 권한을 해제했습니다`);
        return undefined;
      }}
    />
  );
}
