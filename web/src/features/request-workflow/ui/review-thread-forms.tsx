"use client";

import { useState } from "react";
import { Button, Field, Hint, Select, Textarea, toast } from "@/shared/ui";
import { requestApi, type ContentRef, type RequestDetail } from "@/entities/request";
import { handleWorkflowError } from "../model/workflow-error";
import styles from "./thread.module.css";

interface ThreadFormBase {
  request: Pick<RequestDetail, "id">;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
}

interface TargetedFormProps extends ThreadFormBase {
  /** Content shown in the editor (first target option); the other option is 요청 전체. */
  content: ContentRef;
}

type Target = "content" | "all";

function TargetSelect({ id, content, value, onChange }: { id: string; content: ContentRef; value: Target; onChange: (t: Target) => void }) {
  return (
    <Select id={id} aria-label="대상" value={value} onChange={(e) => onChange(e.target.value as Target)}>
      <option value="content">
        {content.key} {content.title}
      </option>
      <option value="all">요청 전체</option>
    </Select>
  );
}

/** 검수 의견 작성 (assigned reviewer, 검수 중). */
export function OpinionForm({ request, content, rowVersion, onDone, onStale }: TargetedFormProps) {
  const [target, setTarget] = useState<Target>("content");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body) return toast("의견을 입력하세요");
    setBusy(true);
    try {
      onDone(await requestApi.addOpinion(request.id, rowVersion(), target === "all" ? null : content.key, body));
      setText("");
    } catch (error) {
      handleWorkflowError(error, onStale);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field className={styles.form} label="검수 의견 작성" htmlFor="op-x">
      <TargetSelect id="op-t" content={content} value={target} onChange={setTarget} />
      <Textarea
        id="op-x"
        rows={3}
        className={styles.ta}
        placeholder="검수 근거와 판단을 남깁니다"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button size="sm" variant="pri" className={styles.send} disabled={busy} onClick={() => void send()}>
        의견 등록
      </Button>
    </Field>
  );
}

export interface AskFormProps extends TargetedFormProps {
  /** Message that blocks sending (e.g. an unsaved revision), or null. */
  blockedReason: () => string | null;
}

/** 요청자에게 확인 요청: the whole request moves to 확인 요청 until the requester answers. */
export function AskForm({ request, content, rowVersion, onDone, onStale, blockedReason }: AskFormProps) {
  const [target, setTarget] = useState<Target>("content");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const question = text.trim();
    if (!question) return toast("확인할 내용을 입력하세요");
    const blocked = blockedReason();
    if (blocked) return toast(blocked);
    setBusy(true);
    try {
      const detail = await requestApi.ask(request.id, rowVersion(), target === "all" ? null : content.key, question);
      setText("");
      toast("확인 요청을 보냈습니다. 요청자가 답변할 때까지 검수가 멈춥니다");
      onDone(detail);
    } catch (error) {
      handleWorkflowError(error, onStale);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Field className={styles.form} label="요청자에게 확인 요청" htmlFor="ask-x">
      <TargetSelect id="ask-t" content={content} value={target} onChange={setTarget} />
      <Textarea
        id="ask-x"
        rows={3}
        className={styles.ta}
        placeholder="확인이 필요한 내용"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Hint>보내면 요청 전체가 확인 요청 상태로 바뀌고 검수가 멈춥니다. 검수 차수는 유지됩니다.</Hint>
      <Button size="sm" variant="pri" className={styles.send} disabled={busy} onClick={() => void send()}>
        확인 요청 보내기
      </Button>
    </Field>
  );
}

export interface AnswerFormProps extends ThreadFormBase {
  askId: number;
  /** Message that blocks answering (an unsaved revision), or null. */
  blockedReason: () => string | null;
}

/** 답변하고 검수 재개 (requester, 확인 요청). */
export function AnswerForm({ request, askId, rowVersion, onDone, onStale, blockedReason }: AnswerFormProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const answer = text.trim();
    if (!answer) return toast("답변을 입력하세요");
    const blocked = blockedReason();
    if (blocked) return toast(blocked);
    setBusy(true);
    try {
      const detail = await requestApi.answer(request.id, rowVersion(), askId, answer);
      setText("");
      toast("답변을 보냈습니다. 요청이 검수 중으로 바뀌었습니다");
      onDone(detail);
    } catch (error) {
      handleWorkflowError(error, onStale);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Textarea
        rows={3}
        aria-label="답변"
        className={styles.answerTa}
        placeholder="답변을 입력하세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button size="sm" variant="pri" className={styles.answerBtn} disabled={busy} onClick={() => void send()}>
        답변하고 검수 재개
      </Button>
    </>
  );
}
