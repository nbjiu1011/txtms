"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, toast } from "@/shared/ui";
import { Checkbox, Field, Input, Modal, Select, useServerError } from "@/shared/common";
import { RichTextEditor } from "@/shared/ui/rich-text";
import { dashboardKeys } from "@/entities/dashboard";
import { noticeApi, noticeKeys, type Notice, type NoticeScope } from "@/entities/notice";
import type { Project } from "@/entities/project";
import {
  NOTICE_CREATED_TOAST,
  NOTICE_SAVED_UNPUBLISHED_TOAST,
  NOTICE_UPDATED_TOAST,
  initialNoticeForm,
  newNoticeBody,
  noticeBody,
  noticeFormProblem,
  type NoticeForm,
} from "../model/notice-form";
import styles from "./admin.module.css";

export interface NoticeEditDialogProps {
  open: boolean;
  onClose: () => void;
  customer: { id: number; name: string };
  projects: Project[];
  currentProjectId: number | null;
  /** null = 공지 작성 */
  notice: Notice | null;
}

/** 공지 작성 / 공지 수정 (reference `noticeEdit`). */
export function NoticeEditDialog(props: NoticeEditDialogProps) {
  if (!props.open) return null;
  return <NoticeEditBody {...props} />;
}

function NoticeEditBody({ onClose, customer, projects, currentProjectId, notice }: NoticeEditDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [form, setForm] = useState<NoticeForm>(() =>
    initialNoticeForm(notice, currentProjectId, projects[0]?.id ?? null),
  );
  const server = useServerError("공지를 저장하지 못했습니다");
  const set = (patch: Partial<NoticeForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const problem = noticeFormProblem(form);
    if (problem) {
      toast(problem);
      return false;
    }
    server.clear();
    try {
      if (notice) await noticeApi.update(notice.id, noticeBody(form));
      else await noticeApi.create(customer.id, newNoticeBody(form));
    } catch (error) {
      return server.fail(error);
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: noticeKeys.all }),
      client.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
    toast(notice ? NOTICE_UPDATED_TOAST : form.published ? NOTICE_CREATED_TOAST : NOTICE_SAVED_UNPUBLISHED_TOAST);
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={notice ? "공지 수정" : "공지 작성"}
      okLabel={notice ? "수정" : form.published ? "게시" : "저장"}
      onOk={submit}
    >
      <Field label="공지 범위" htmlFor={`${id}-scope`} error={server.field("scope")}>
        <Select id={`${id}-scope`} value={form.scope} onChange={(e) => set({ scope: e.target.value as NoticeScope })}>
          <option value="PROJECT">프로젝트 공지</option>
          <option value="CUSTOMER">{`고객사 전체 공지 (${customer.name})`}</option>
        </Select>
      </Field>
      {form.scope === "PROJECT" ? (
        <Field label="프로젝트" htmlFor={`${id}-project`} error={server.field("projectId")}>
          <Select id={`${id}-project`} value={form.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className={styles.smallMutedTop}>고객사 전체 구성원에게 보이며 프로젝트나 역할로 거르지 않습니다.</p>
      )}
      <Field label="제목" required htmlFor={`${id}-title`} error={server.field("title")}>
        <Input id={`${id}-title`} value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="내용" required error={server.field("body")}>
        <RichTextEditor
          aria-label="내용"
          value={form.body}
          invalid={!!server.field("body")}
          onChange={(body) => set({ body })}
        />
      </Field>
      {notice ? null : (
        <Checkbox
          label="바로 게시"
          checked={form.published}
          onChange={(e) => set({ published: e.target.checked })}
        />
      )}
      {notice || form.published ? null : (
        <p className={styles.smallMutedTop}>미게시로 저장하면 사용자에게 보이지 않습니다. 공지 관리에서 게시할 수 있습니다.</p>
      )}
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
