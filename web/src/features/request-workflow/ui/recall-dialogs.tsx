"use client";

import { useState } from "react";
import { toast } from "@/shared/ui";
import { Field, Modal, Textarea } from "@/shared/common";
import { requestApi, type RequestDetail } from "@/entities/request";
import { firstMissing } from "../model/assignment-form";
import { handleWorkflowError, modalResult } from "../model/workflow-error";
import styles from "./workflow.module.css";

interface BaseProps {
  onClose: () => void;
  request: RequestDetail;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

export interface RecallDialogProps extends BaseProps {
  open: boolean;
  primaryName: string;
}

/** 회수 요청 (requester, 검수 중): reason → the primary reviewer approves or rejects. */
export function RecallDialog(props: RecallDialogProps) {
  if (!props.open) return null;
  return <RecallBody {...props} />;
}

function RecallBody({ onClose, request: r, rowVersion, onDone, onStale, primaryName }: RecallDialogProps) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="회수를 요청할까요?"
      description={`주담당 검수자 ${primaryName}님이 승인하면 작성 중으로 돌아갑니다. 처리 전까지는 편집할 수 없습니다.`}
      okLabel="회수 요청"
      okVariant="warn"
      onOk={async () => {
        const problem = firstMissing([[reason, "회수 사유"]]);
        if (problem) {
          toast(problem);
          return false;
        }
        try {
          onDone(await requestApi.recall(r.id, rowVersion(), reason.trim()));
          return undefined;
        } catch (error) {
          return modalResult(handleWorkflowError(error, onStale));
        }
      }}
    >
      <Field label="회수 사유" required htmlFor="recall-why">
        <Textarea id="recall-why" rows={3} className={styles.ta} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

export interface RecallDecisionDialogProps extends BaseProps {
  /** null = closed; true = 회수 승인, false = 회수 거절. */
  approve: boolean | null;
}

/** 회수 승인 / 거절 (primary reviewer) with the required 처리 의견. */
export function RecallDecisionDialog(props: RecallDecisionDialogProps) {
  if (props.approve === null) return null;
  return <DecisionBody {...props} approve={props.approve} />;
}

function DecisionBody({ approve, onClose, request: r, rowVersion, onDone, onStale }: RecallDecisionDialogProps & { approve: boolean }) {
  const [comment, setComment] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? "회수를 승인할까요?" : "회수를 거절할까요?"}
      description={
        approve
          ? "요청이 작성 중으로 돌아가고 현재 배정이 해제됩니다. 다시 요청하면 검수 차수가 올라갑니다."
          : "현재 배정으로 검수를 이어갑니다."
      }
      okLabel={approve ? "회수 승인" : "회수 거절"}
      okVariant={approve ? "pri" : "default"}
      onOk={async () => {
        const problem = firstMissing([[comment, "처리 의견"]]);
        if (problem) {
          toast(problem);
          return false;
        }
        try {
          onDone(await requestApi.decideRecall(r.id, rowVersion(), approve, comment.trim()));
          return undefined;
        } catch (error) {
          return modalResult(handleWorkflowError(error, onStale));
        }
      }}
    >
      <Field label="처리 의견" required htmlFor="recall-op">
        <Textarea id="recall-op" rows={3} className={styles.ta} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
    </Modal>
  );
}
