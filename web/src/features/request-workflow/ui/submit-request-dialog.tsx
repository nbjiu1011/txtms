"use client";

import { useState } from "react";
import { isApiError, type FieldError } from "@/shared/api";
import { Modal, toast } from "@/shared/ui";
import { requestApi, type RequestDetail } from "@/entities/request";
import styles from "./workflow.module.css";

/** Shown when pending edits could not be saved before submitting (reference `storeError`). */
export const SAVE_BEFORE_SUBMIT_FAILED = "저장 실패: 3회 재시도했습니다. 수동 저장을 실행하세요.";
const MISSING_TITLE = "검수를 요청하려면 다음 항목을 채우세요";
const CORRECTION_NOTE = "텍스트 교정 결과는 필요하지 않습니다.";

export interface SubmitRequestDialogProps {
  open: boolean;
  onClose: () => void;
  request: Pick<RequestDetail, "id" | "contents">;
  projectName: string;
  leadName: string;
  /** Current `rowVersion` (read at submit time: autosave may have changed it). */
  rowVersion: () => number;
  /** Saves pending edits first; resolving false aborts the submit. */
  beforeSubmit: () => Promise<boolean>;
  onSubmitted: (detail: RequestDetail) => void;
  /** Submit validation failed: field errors of the 요청 정보 tab (may be empty). */
  onInvalid: (fieldErrors: FieldError[]) => void;
  /** After the missing-items list: go to 요청 정보 (info errors) or 콘텐츠. */
  onShowMissing: (target: "info" | "contents") => void;
  /** The request changed meanwhile (state conflict): reload it. */
  onStale: () => void;
}

interface Missing {
  items: string[];
  target: "info" | "contents";
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `submit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 검수 요청: confirmation (target lead reviewer, correction is optional) → `POST submit` with the
 * row version and an idempotency key (a retried click never submits twice). A `VALIDATION_FAILED`
 * answer lists the missing items like the reference modal.
 */
export function SubmitRequestDialog(props: SubmitRequestDialogProps) {
  const { open, onClose, request, projectName, leadName } = props;
  const [missing, setMissing] = useState<Missing | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setKey(newIdempotencyKey());
  }

  const submit = async () => {
    if (!(await props.beforeSubmit())) {
      toast(SAVE_BEFORE_SUBMIT_FAILED);
      return false;
    }
    try {
      const detail = await requestApi.submit(request.id, props.rowVersion(), key);
      toast("검수를 요청했습니다");
      props.onSubmitted(detail);
      return undefined;
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_FAILED" && error.details.length > 0) {
        const infoErrors = error.fieldErrors;
        props.onInvalid(infoErrors);
        setMissing({ items: error.details, target: infoErrors.length > 0 ? "info" : "contents" });
        onClose();
        return false;
      }
      toast(isApiError(error) ? error.message : "검수를 요청하지 못했습니다");
      if (isApiError(error) && (error.code === "REQUEST_STATE_CONFLICT" || error.status === 403)) props.onStale();
      return undefined;
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="검수를 요청할까요?"
        description={`${request.contents.length}건의 콘텐츠를 ${projectName} 대표 검수자 ${leadName}님에게 보냅니다.`}
        okLabel="검수 요청"
        onOk={submit}
      >
        <p className={styles.note}>텍스트 교정은 선택 사항입니다. {CORRECTION_NOTE}</p>
      </Modal>
      <Modal
        open={missing !== null}
        onClose={() => setMissing(null)}
        title={MISSING_TITLE}
        okLabel="확인"
        onOk={() => {
          if (missing) props.onShowMissing(missing.target);
        }}
      >
        <ul className={styles.missing}>
          {missing?.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.note}>{CORRECTION_NOTE}</p>
      </Modal>
    </>
  );
}
