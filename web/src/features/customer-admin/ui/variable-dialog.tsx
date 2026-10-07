"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox, ErrorDetails, Field, Input, Modal, Select, toast } from "@/shared/ui";
import { projectKeys } from "@/entities/project";
import {
  VARIABLE_TYPES,
  VARIABLE_TYPE_OPTION_LABEL,
  variableApi,
  variableKeys,
  type Variable,
  type VariableType,
} from "@/entities/variable";
import { initialVariableForm, variableFormProblem, variablePatch, type VariableForm } from "../model/variable-form";
import { useServerError } from "@/shared/ui";

export interface VariableDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  /** null = 변수 등록 */
  variable: Variable | null;
}

/** 변수 등록 / 변수 편집 (reference `variableModal`). */
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
    <Modal open onClose={onClose} title={variable ? "변수 편집" : "변수 등록"} okLabel="저장" onOk={submit}>
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
    </Modal>
  );
}
