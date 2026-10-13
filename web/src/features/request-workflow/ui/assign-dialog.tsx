"use client";

import { useState } from "react";
import { formatDate } from "@/shared/lib";
import { toast } from "@/shared/ui";
import { Field, Input, Modal, Select, Textarea } from "@/shared/common";
import { URGENCIES, URGENCY_LABEL, requestApi, type RequestDetail, type Urgency } from "@/entities/request";
import {
  initialAssignmentForm,
  toAssignBody,
  toChangeBody,
  validateAssignment,
  type AssignmentForm,
  type AssignmentMode,
} from "../model/assignment-form";
import { handleWorkflowError, modalResult } from "../model/workflow-error";
import { ReviewerPicker, type ReviewerCandidate } from "./reviewer-picker";
import styles from "./workflow.module.css";

export interface AssignDialogProps {
  /** null = closed. */
  mode: AssignmentMode | null;
  onClose: () => void;
  request: RequestDetail;
  candidates: readonly ReviewerCandidate[];
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

/** 검수자 배정 (배정 대기) / 검수자 변경 (검수 중, 사유 + 인수인계) — reference `assign`. */
export function AssignDialog(props: AssignDialogProps) {
  if (props.mode === null) return null;
  return <AssignDialogBody {...props} mode={props.mode} />;
}

function AssignDialogBody({ mode, onClose, request: r, candidates, rowVersion, onDone, onStale }: AssignDialogProps & { mode: AssignmentMode }) {
  const [form, setForm] = useState<AssignmentForm>(() => initialAssignmentForm(r));
  const change = mode === "change";

  const submit = async () => {
    const problem = validateAssignment(form, mode, r);
    if (problem) {
      toast(problem);
      return false;
    }
    try {
      const detail = change
        ? await requestApi.changeAssignment(r.id, rowVersion(), toChangeBody(form))
        : await requestApi.assign(r.id, rowVersion(), toAssignBody(form));
      onDone(detail);
      return undefined;
    } catch (error) {
      return modalResult(handleWorkflowError(error, onStale));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={change ? "검수자 변경" : "검수자 배정"}
      description={`${r.id} ${r.title}`}
      okLabel={change ? "변경" : "배정"}
      onOk={submit}
    >
      <ReviewerPicker candidates={candidates} form={form} onChange={setForm} />
      {change ? (
        <>
          <Field label="변경 사유" required htmlFor="assign-why">
            <Textarea
              id="assign-why"
              rows={3}
              className={styles.ta}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <Field label="인수인계 내용" required htmlFor="assign-ho">
            <Textarea
              id="assign-ho"
              rows={3}
              className={styles.ta}
              placeholder="진행 상황, 남은 확인 사항"
              value={form.handover}
              onChange={(e) => setForm({ ...form, handover: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <>
          <div className={styles.grid2}>
            <Field label="확정 납기" required htmlFor="assign-due">
              <Input
                id="assign-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
            <UrgencyField id="assign-urg" value={form.urgency} onChange={(urgency) => setForm({ ...form, urgency })} />
          </div>
          <p className={styles.dueNote}>요청자 희망 납기 {formatDate(r.hopeDueDate)}는 그대로 보존됩니다.</p>
        </>
      )}
    </Modal>
  );
}

export function UrgencyField({ id, value, onChange }: { id: string; value: Urgency; onChange: (value: Urgency) => void }) {
  return (
    <Field label="긴급도" htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as Urgency)}>
        {URGENCIES.map((u) => (
          <option key={u} value={u}>
            {URGENCY_LABEL[u]}
          </option>
        ))}
      </Select>
    </Field>
  );
}
