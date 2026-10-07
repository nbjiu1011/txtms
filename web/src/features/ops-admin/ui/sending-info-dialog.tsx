"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverFormError } from "@/shared/api";
import { Button, ErrorDetails, Field, Icon, IconButton, Input, Modal, toast } from "@/shared/ui";
import { opsApi } from "@/entities/ops";
import type { Project } from "@/entities/project";
import { invalidateOps } from "../model/invalidate";
import {
  MAX_SENDERS,
  MAX_TEMPLATES,
  SENDING_SAVED_TOAST,
  firstProblem,
  normalizeSending,
  sameSenders,
  sameTemplates,
  sendingProblems,
  type SendingForm,
} from "../model/sending-form";
import styles from "./ops.module.css";

export interface SendingInfoDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

/**
 * 발신 정보 설정 — the project's 알림톡 templates and 문자 sender numbers that request submission is
 * checked against (contract §12, replaced as whole lists). Not in the reference: needed so a new
 * customer's requesters can submit 알림톡/문자.
 */
export function SendingInfoDialog(props: SendingInfoDialogProps) {
  if (!props.open || !props.project) return null;
  return <SendingBody {...props} project={props.project} />;
}

function SendingBody({ onClose, project }: SendingInfoDialogProps & { project: Project }) {
  const client = useQueryClient();
  const [form, setForm] = useState<SendingForm>(() => ({
    templates: project.templates.map((t) => ({ ...t })),
    senders: [...project.senders],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ message: string; items: string[] }>({ message: "", items: [] });

  const setTemplate = (i: number, patch: Partial<{ code: string; name: string }>) =>
    setForm((f) => ({ ...f, templates: f.templates.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));
  const setSender = (i: number, value: string) =>
    setForm((f) => ({ ...f, senders: f.senders.map((s, k) => (k === i ? value : s)) }));
  const removeTemplate = (i: number) => {
    setErrors({});
    setForm((f) => ({ ...f, templates: f.templates.filter((_, k) => k !== i) }));
  };
  const removeSender = (i: number) => {
    setErrors({});
    setForm((f) => ({ ...f, senders: f.senders.filter((_, k) => k !== i) }));
  };

  const submit = async () => {
    const problems = sendingProblems(form);
    const first = firstProblem(problems);
    setErrors(problems);
    setFailure({ message: "", items: [] });
    if (first) {
      toast(first);
      return false;
    }
    const next = normalizeSending(form);
    const templatesChanged = !sameTemplates(next.templates, project.templates);
    const sendersChanged = !sameSenders(next.senders, project.senders);
    try {
      if (templatesChanged) await opsApi.putTemplates(project.id, next.templates);
      if (sendersChanged) await opsApi.putSenders(project.id, next.senders);
    } catch (error) {
      const e = serverFormError(error, "발신 정보를 저장하지 못했습니다");
      setErrors(e.fields);
      const underRow = Object.values(e.fields).includes(e.message);
      setFailure({ message: underRow ? "" : e.message, items: e.details });
      toast(e.message);
      await invalidateOps(client);
      return false;
    }
    if (templatesChanged || sendersChanged) {
      await invalidateOps(client);
      toast(SENDING_SAVED_TOAST);
    }
    return undefined;
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`${project.name} 발신 정보`}
      description="알림톡은 등록한 템플릿 코드, 문자는 등록한 발신번호와 같아야 검수 요청할 수 있습니다."
      okLabel="저장"
      onOk={submit}
    >
      <div className={styles.editorH}>
        <h3>알림톡 템플릿</h3>
        <span className={styles.count}>{form.templates.length}개</span>
        <Button
          size="sm"
          className={styles.add}
          disabled={form.templates.length >= MAX_TEMPLATES}
          onClick={() => setForm((f) => ({ ...f, templates: [...f.templates, { code: "", name: "" }] }))}
        >
          <Icon name="plus" />
          템플릿 추가
        </Button>
      </div>
      <div className={styles.rows}>
        {form.templates.length === 0 ? <div className={styles.emptyRows}>등록된 템플릿이 없습니다.</div> : null}
        {form.templates.map((t, i) => (
          <div key={i} className={styles.tplRow}>
            <Field className={styles.rowFld} error={errors[`templates.${i}.code`]}>
              <Input
                aria-label={`템플릿 ${i + 1} 코드`}
                placeholder="템플릿 코드 (예: HB_POINT_01)"
                value={t.code}
                onChange={(e) => setTemplate(i, { code: e.target.value })}
              />
            </Field>
            <Field className={styles.rowFld} error={errors[`templates.${i}.name`]}>
              <Input
                aria-label={`템플릿 ${i + 1} 이름`}
                placeholder="템플릿 이름"
                value={t.name}
                onChange={(e) => setTemplate(i, { name: e.target.value })}
              />
            </Field>
            <IconButton label={`템플릿 ${i + 1} 삭제`} onClick={() => removeTemplate(i)}>
              <Icon name="x" />
            </IconButton>
          </div>
        ))}
        {errors.templates ? <p className={styles.small}>{errors.templates}</p> : null}
      </div>
      <div className={styles.editorH}>
        <h3>문자 발신번호</h3>
        <span className={styles.count}>{form.senders.length}개</span>
        <Button
          size="sm"
          className={styles.add}
          disabled={form.senders.length >= MAX_SENDERS}
          onClick={() => setForm((f) => ({ ...f, senders: [...f.senders, ""] }))}
        >
          <Icon name="plus" />
          발신번호 추가
        </Button>
      </div>
      <div className={styles.rows}>
        {form.senders.length === 0 ? <div className={styles.emptyRows}>등록된 발신번호가 없습니다.</div> : null}
        {form.senders.map((s, i) => (
          <div key={i} className={styles.sndRow}>
            <Field className={styles.rowFld} error={errors[`senders.${i}`]}>
              <Input
                aria-label={`발신번호 ${i + 1}`}
                placeholder="예: 1588-0000, 02-3456-7000"
                inputMode="tel"
                value={s}
                onChange={(e) => setSender(i, e.target.value)}
              />
            </Field>
            <IconButton label={`발신번호 ${i + 1} 삭제`} onClick={() => removeSender(i)}>
              <Icon name="x" />
            </IconButton>
          </div>
        ))}
        {errors.senders ? <p className={styles.small}>{errors.senders}</p> : null}
      </div>
      <p className={styles.smallMuted}>
        입력한 그대로 저장합니다(하이픈 생략 가능). 저장한 목록은 이후 검수 요청부터 적용됩니다.
      </p>
      <ErrorDetails message={failure.message} items={failure.items} />
    </Modal>
  );
}
