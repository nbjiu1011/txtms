"use client";

import { useState } from "react";
import { ListItem, Panel, Tag, toast } from "@/shared/ui";
import { Field, Input, Modal, Select, Textarea } from "@/shared/common";
import { requestApi, type RequestDetail } from "@/entities/request";
import { firstMissing } from "../model/assignment-form";
import { handleWorkflowError, modalResult } from "../model/workflow-error";
import styles from "./workflow.module.css";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  request: RequestDetail;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

/** 최종 승인 (eligible approver): fixes the completion bundle. */
export function ApproveDialog({ open, onClose, request: r, rowVersion, onDone, onStale }: BaseProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="최종 승인할까요?"
      description="승인하면 완료 묶음이 고정되고 이후 수정은 후속 요청으로만 할 수 있습니다."
      okLabel="승인"
      okVariant="ok"
      onOk={async () => {
        try {
          const detail = await requestApi.approve(r.id, rowVersion());
          toast("승인했습니다");
          onDone(detail);
          return undefined;
        } catch (error) {
          return modalResult(handleWorkflowError(error, onStale));
        }
      }}
    >
      <Panel aria-label="승인 대상 콘텐츠">
        {r.contents.map((c) => (
          <ListItem
            key={c.key}
            leading={<Tag variant="fill">{c.key}</Tag>}
            title={c.title}
            trailing={<span className={styles.versions}>v{c.version}</span>}
          />
        ))}
      </Panel>
    </Modal>
  );
}

export interface ReviseDialogProps extends BaseProps {
  /** Names of the assigned reviewers (they review again). */
  reviewerNames: string;
}

/** 수정 요청 (eligible approver): back to 검수 중 with round + 1. */
export function ReviseDialog(props: ReviseDialogProps) {
  if (!props.open) return null;
  return <ReviseBody {...props} />;
}

function ReviseBody({ onClose, request: r, rowVersion, onDone, onStale, reviewerNames }: ReviseDialogProps) {
  const [reason, setReason] = useState("");
  const [contentKey, setContentKey] = useState(r.contents[0]?.key ?? "");
  const [location, setLocation] = useState("");
  const [expectation, setExpectation] = useState("");

  const submit = async () => {
    const problem = firstMissing([
      [reason, "이유"],
      [expectation, "기대 내용"],
    ]);
    if (problem) {
      toast(problem);
      return false;
    }
    try {
      const detail = await requestApi.revise(r.id, rowVersion(), {
        reason: reason.trim(),
        expectation: expectation.trim(),
        contentKey,
        location: location.trim() || null,
      });
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
      title="수정 요청"
      description={`검수 중으로 돌아가 기존 검수자 ${reviewerNames}가 재검수합니다. 검수 차수가 ${r.round + 1}차로 올라갑니다.`}
      okLabel="수정 요청"
      onOk={submit}
    >
      <Field label="이유" required htmlFor="revise-why">
        <Textarea id="revise-why" rows={3} className={styles.ta} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label="위치" required htmlFor="revise-loc">
        <Select id="revise-loc" value={contentKey} onChange={(e) => setContentKey(e.target.value)}>
          {r.contents.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key} {c.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="세부 위치" htmlFor="revise-locd">
        <Input
          id="revise-locd"
          placeholder="예: 카드 1 본문 두 번째 문장"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </Field>
      <Field label="기대 내용" required htmlFor="revise-exp">
        <Textarea
          id="revise-exp"
          rows={3}
          className={styles.ta}
          value={expectation}
          onChange={(e) => setExpectation(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
