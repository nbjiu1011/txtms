"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { isApiError, type FieldError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Modal } from "@/shared/common";
import { requestApi, type RequestDetail } from "@/entities/request";
import styles from "./workflow.module.css";

/** Shown when pending edits could not be saved before submitting (reference `storeError`). */
export const SAVE_BEFORE_SUBMIT_FAILED = "저장 실패: 3회 재시도했습니다. 수동 저장을 실행하세요.";
const MISSING_TITLE = "검수를 요청하려면 다음 항목을 채우세요";
const CORRECTION_NOTE = "텍스트 교정 결과는 필요하지 않습니다.";
const WARNINGS_TITLE = "채널 규격 확인";
const WARNINGS_NOTE = "규격 초과는 안내일 뿐 검수 요청을 막지 않습니다.";

export interface SubmitRequestDialogProps {
  open: boolean;
  onClose: () => void;
  request: Pick<RequestDetail, "id" | "contents" | "round" | "nextSubmitRound">;
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

/** Channel spec warnings of the pre-check (§17.3): listed, never blocking. */
function SpecWarnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.warnings}>
      <span className={styles.lbl}>
        {WARNINGS_TITLE} ({items.length}건)
      </span>
      <ul className={styles.missing} aria-label={WARNINGS_TITLE}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className={styles.note}>{WARNINGS_NOTE}</p>
    </div>
  );
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `submit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A server without the submit pre-check (404/405): fall back to submit-then-list. */
function checkUnavailable(error: unknown): boolean {
  return isApiError(error) && (error.status === 404 || error.status === 405);
}

/**
 * 검수 요청: pending edits are saved, the submit rules are checked first (`submit-check`, the
 * reference shows the missing-items list before asking), then the confirmation (target lead reviewer,
 * round increase after a recall, correction is optional) → `POST submit` with the row version and an
 * idempotency key (a retried click never submits twice). A server without the pre-check answers the
 * submit itself with `VALIDATION_FAILED` and the same list.
 */
export function SubmitRequestDialog(props: SubmitRequestDialogProps) {
  const { open, onClose, request, projectName, leadName } = props;
  const [missing, setMissing] = useState<Missing | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [key, setKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKey(newIdempotencyKey());
      setWarnings([]);
    }
    if (!open) setConfirming(false);
  }
  const handlers = useRef(props);
  useLayoutEffect(() => {
    handlers.current = props;
  });

  const showMissing = (items: string[], fieldErrors: FieldError[]) => {
    handlers.current.onInvalid(fieldErrors);
    setMissing({ items, target: fieldErrors.length > 0 ? "info" : "contents" });
  };

  // Opening runs the pre-check; the confirmation appears only when nothing is missing.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const p = handlers.current;
      if (!(await p.beforeSubmit())) {
        toast(SAVE_BEFORE_SUBMIT_FAILED);
        if (!cancelled) p.onClose();
        return;
      }
      try {
        const check = await requestApi.submitCheck(p.request.id);
        if (cancelled) return;
        setWarnings(check.warnings ?? []);
        if (check.ok) setConfirming(true);
        else {
          showMissing(check.details, check.fieldErrors);
          p.onClose();
        }
      } catch (error) {
        if (cancelled) return;
        if (checkUnavailable(error)) setConfirming(true);
        else {
          toast(isApiError(error) ? error.message : "검수를 요청하지 못했습니다");
          if (isApiError(error) && (error.code === "REQUEST_STATE_CONFLICT" || error.status === 403)) p.onStale();
          p.onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);
  const bump = request.nextSubmitRound > request.round;

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
        showMissing(error.details, error.fieldErrors);
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
        open={open && confirming}
        onClose={onClose}
        title="검수를 요청할까요?"
        description={`${request.contents.length}건의 콘텐츠를 ${projectName} 대표 검수자 ${leadName}님에게 보냅니다.`}
        okLabel="검수 요청"
        onOk={submit}
      >
        {bump ? (
          <p className={styles.small}>회수 승인 후 다시 요청하므로 검수 차수가 {request.nextSubmitRound}차로 올라갑니다.</p>
        ) : null}
        <p className={styles.note}>텍스트 교정은 선택 사항입니다. {CORRECTION_NOTE}</p>
        <SpecWarnings items={warnings} />
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
        <ul className={styles.missing} aria-label="채울 항목">
          {missing?.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.note}>{CORRECTION_NOTE}</p>
        <SpecWarnings items={warnings} />
      </Modal>
    </>
  );
}
