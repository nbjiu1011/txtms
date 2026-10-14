"use client";

import { useState } from "react";
import { formatDate, kstDateKey } from "@/shared/lib";
import { toast } from "@/shared/ui";
import { DatePicker, Field, Modal, Textarea } from "@/shared/common";
import { requestApi, type RequestDetail, type Urgency } from "@/entities/request";
import { firstMissing } from "../model/assignment-form";
import { handleWorkflowError, modalResult } from "../model/workflow-error";
import { UrgencyField } from "./assign-dialog";
import styles from "./workflow.module.css";

export interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  request: RequestDetail;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

/** 납기·긴급도 변경 (reference `dueEdit`): 확정 납기, 긴급도, 변경 사유. 희망 납기 is kept. */
export function ScheduleDialog(props: ScheduleDialogProps) {
  if (!props.open) return null;
  return <ScheduleBody {...props} />;
}

function ScheduleBody({ onClose, request: r, rowVersion, onDone, onStale }: ScheduleDialogProps) {
  // Without a due date the reference starts from today.
  const [dueDate, setDueDate] = useState(() => r.dueDate ?? kstDateKey(Date.now()));
  const [urgency, setUrgency] = useState<Urgency>(r.urgency);
  const [reason, setReason] = useState("");

  const submit = async () => {
    const problem = firstMissing([[reason, "변경 사유"]]) ?? (dueDate ? null : "확정 납기를 입력하세요");
    if (problem) {
      toast(problem);
      return false;
    }
    try {
      onDone(await requestApi.schedule(r.id, rowVersion(), { dueDate, urgency, reason: reason.trim() }));
      return undefined;
    } catch (error) {
      return modalResult(handleWorkflowError(error, onStale));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="납기·긴급도 변경"
      description={`요청자 희망 납기 ${formatDate(r.hopeDueDate)}는 보존됩니다.`}
      okLabel="변경"
      onOk={submit}
    >
      <div className={styles.grid2}>
        <Field label="확정 납기" required htmlFor="due-date">
          <DatePicker id="due-date" required value={dueDate} onChange={setDueDate} />
        </Field>
        <UrgencyField id="due-urg" value={urgency} onChange={setUrgency} />
      </div>
      <Field label="변경 사유" required htmlFor="due-why">
        <Textarea id="due-why" rows={3} className={styles.ta} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
