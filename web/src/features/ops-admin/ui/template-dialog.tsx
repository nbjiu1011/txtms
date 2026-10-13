"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { serverFormError } from "@/shared/api";
import { ErrorDetails, Icon, toast } from "@/shared/ui";
import { Button, Field, IconButton, Input, Modal } from "@/shared/common";
import { opsApi } from "@/entities/ops";
import type { Project } from "@/entities/project";
import { invalidateOps } from "../model/invalidate";
import {
  MAX_TEMPLATES,
  TEMPLATES_SAVED_TOAST,
  firstProblem,
  normalizeTemplates,
  sameTemplates,
  templateProblems,
  type TemplateForm,
} from "../model/template-form";
import styles from "./ops.module.css";

export interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

/**
 * 알림톡 템플릿 설정 — the project's 알림톡 templates that request submission is checked against
 * (contract §12, replaced as a whole list). Not in the reference: needed so a new customer's
 * requesters can submit 알림톡.
 */
export function TemplateDialog(props: TemplateDialogProps) {
  if (!props.open || !props.project) return null;
  return <TemplateBody {...props} project={props.project} />;
}

function TemplateBody({ onClose, project }: TemplateDialogProps & { project: Project }) {
  const client = useQueryClient();
  const [form, setForm] = useState<TemplateForm>(() => ({
    templates: project.templates.map((t) => ({ ...t })),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ message: string; items: string[] }>({ message: "", items: [] });

  const setTemplate = (i: number, patch: Partial<{ code: string; name: string }>) =>
    setForm((f) => ({ ...f, templates: f.templates.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));
  const removeTemplate = (i: number) => {
    setErrors({});
    setForm((f) => ({ ...f, templates: f.templates.filter((_, k) => k !== i) }));
  };

  const submit = async () => {
    const problems = templateProblems(form);
    const first = firstProblem(problems);
    setErrors(problems);
    setFailure({ message: "", items: [] });
    if (first) {
      toast(first);
      return false;
    }
    const next = normalizeTemplates(form);
    if (sameTemplates(next.templates, project.templates)) return undefined;
    try {
      await opsApi.putTemplates(project.id, next.templates);
    } catch (error) {
      const e = serverFormError(error, "알림톡 템플릿을 저장하지 못했습니다");
      setErrors(e.fields);
      const underRow = Object.values(e.fields).includes(e.message);
      setFailure({ message: underRow ? "" : e.message, items: e.details });
      toast(e.message);
      await invalidateOps(client);
      return false;
    }
    await invalidateOps(client);
    toast(TEMPLATES_SAVED_TOAST);
    return undefined;
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`${project.name} 알림톡 템플릿`}
      description="알림톡은 등록한 템플릿 코드와 같아야 검수 요청할 수 있습니다."
      okLabel="저장"
      onOk={submit}
    >
      <div className={styles.editorH}>
        <h3>템플릿 목록</h3>
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
      <p className={styles.smallMuted}>
        앞뒤 공백은 지우고 저장합니다. 저장한 목록은 이후 검수 요청부터 적용됩니다.
      </p>
      <ErrorDetails message={failure.message} items={failure.items} />
    </Modal>
  );
}
