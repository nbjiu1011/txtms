"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorDetails, toast } from "@/shared/ui";
import { Button, Checkbox, ConfirmModal, Field, Input, Modal, Select, useServerError } from "@/shared/common";
import { projectKeys } from "@/entities/project";
import {
  VARIABLE_TYPES,
  VARIABLE_TYPE_OPTION_LABEL,
  variableApi,
  variableKeys,
  type Variable,
  type VariableType,
} from "@/entities/variable";
import { useDeleteVariable } from "../model/variable-actions";
import { initialVariableForm, variableFormProblem, variablePatch, type VariableForm } from "../model/variable-form";

export interface VariableDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** null = 변수 등록 */
  variable: Variable | null;
}

/**
 * 변수 등록 / 변수 편집 (reference `variableModal`). Editing also offers 삭제, asked first; a variable in use (or an
 * already deleted one) cannot be deleted.
 */
export function VariableDialog(props: VariableDialogProps) {
  if (!props.open) return null;
  return <VariableBody {...props} />;
}

function VariableBody({ onClose, projectId, variable }: VariableDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [form, setForm] = useState<VariableForm>(() => initialVariableForm(variable));
  const server = useServerError("변수를 저장하지 못했습니다");
  const set = (patch: Partial<VariableForm>) => setForm((f) => ({ ...f, ...patch }));
  const deletion = useDeleteVariable();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    const problem = variableFormProblem(form, variable);
    if (problem) {
      toast(problem);
      return false;
    }
    server.clear();
    try {
      if (variable) {
        const patch = variablePatch(form, variable);
        if (Object.keys(patch).length) await variableApi.update(variable.id, patch);
      } else {
        const created = await variableApi.create(projectId, {
          key: form.key.trim(),
          description: form.description,
          type: form.type,
          value: form.value,
        });
        // Registration always starts 사용; an unchecked 사용 is applied right after.
        if (!form.active) await variableApi.update(created.id, { active: false });
      }
    } catch (error) {
      return server.fail(error);
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: variableKeys.all }),
      client.invalidateQueries({ queryKey: variableKeys.logsAll }),
      client.invalidateQueries({ queryKey: projectKeys.all }),
    ]);
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={variable ? "변수 편집" : "변수 등록"}
      okLabel="저장"
      onOk={submit}
      foot={
        variable ? (
          <Button
            variant="warn"
            disabled={variable.inUse || variable.deleted || deletion.busyId === variable.id}
            title={variable.inUse ? "사용 중인 변수는 삭제할 수 없습니다" : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            삭제
          </Button>
        ) : undefined
      }
    >
      <Field label="변수 키" required htmlFor={`${id}-key`} error={server.field("key")}>
        <Input
          id={`${id}-key`}
          placeholder="customer_name"
          value={form.key}
          onChange={(e) => set({ key: e.target.value })}
        />
      </Field>
      <Field label="설명" htmlFor={`${id}-desc`} error={server.field("description")}>
        <Input id={`${id}-desc`} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="자료형" htmlFor={`${id}-type`} error={server.field("type")}>
        <Select id={`${id}-type`} value={form.type} onChange={(e) => set({ type: e.target.value as VariableType })}>
          {VARIABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {VARIABLE_TYPE_OPTION_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="값" required htmlFor={`${id}-value`} error={server.field("value")}>
        <Input id={`${id}-value`} value={form.value} onChange={(e) => set({ value: e.target.value })} />
      </Field>
      <Checkbox label="사용" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
      {variable ? (
        <ConfirmModal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`「${variable.key}」 변수를 삭제할까요?`}
          description="삭제한 변수는 이력과 함께 목록에 남고, 같은 키로 다시 등록할 수 없습니다."
          confirmLabel="삭제"
          onConfirm={async () => {
            if (!(await deletion.remove(variable))) return false;
            onClose();
            return undefined;
          }}
        />
      ) : null}
    </Modal>
  );
}
