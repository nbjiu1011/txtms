"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { Button, Icon, IconButton } from "@/shared/ui";
import type { CardView } from "../model/card";
import { fieldLabel } from "../model/field-label";
import type { GroupState } from "../model/run";
import styles from "./correction.module.css";

export interface CorrectionCardProps {
  contentKey: string;
  group: GroupState;
  view: CardView;
  /** ④ 건의하기 is available (EDIT_CONTENT or REVIEW). */
  canSuggest: boolean;
  onApply: (optionIndex: number) => void;
  onRestore: () => void;
  onSuggest: () => void;
  /** Card click / Enter: select the expression in the editor. */
  onReveal: () => void;
}

const INTERACTIVE = "button,select,option,a,input,textarea";

/**
 * Result card (화면설계 PNG): ⑤ 교정 유형 라벨 header with ④ 건의하기, ① 기존 표현, ② 권장 표현
 * button (1:1) or 2-2 select (1:N) that applies at once, ③ 복원 (enabled once applied), 교정 이유.
 */
export function CorrectionCard({ contentKey, group, view, canSuggest, onApply, onRestore, onSuggest, onReveal }: CorrectionCardProps) {
  const applied = view.applied !== null;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    onReveal();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && e.key === "Enter") {
      e.preventDefault();
      onReveal();
    }
  };
  return (
    <article
      className={styles.card}
      tabIndex={0}
      data-applied={applied || undefined}
      aria-label={`${contentKey} ${fieldLabel(group.field)} ${group.matchedText} 교정 결과`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <header className={styles.cardHead}>
        <b className={styles.label}>{view.label}</b>
        <span className={styles.field}>{fieldLabel(group.field)}</span>
        <IconButton
          className={styles.send}
          label="건의하기"
          title={canSuggest ? "건의하기" : "건의는 편집 또는 검수 권한이 있을 때 보낼 수 있습니다"}
          disabled={!canSuggest}
          onClick={onSuggest}
        >
          <Icon name="send" />
        </IconButton>
      </header>
      <div className={styles.orig}>
        <span className={styles.tiny}>기존 표현</span>
        <span className={styles.origText}>{group.matchedText}</span>
      </div>
      {view.mode === "describe" ? null : (
        <div className={styles.recRow}>
          <span className={styles.arrow} aria-hidden="true">
            ▶
          </span>
          {view.mode === "single" ? (
            <SingleChoice view={view} onApply={onApply} />
          ) : (
            <MultiChoice view={view} matched={group.matchedText} onApply={onApply} />
          )}
          <Button
            size="sm"
            variant={view.canRestore ? "warn" : "default"}
            disabled={!view.canRestore}
            aria-label={`${group.matchedText}(으)로 복원`}
            onClick={onRestore}
          >
            복원
          </Button>
        </div>
      )}
      <p className={styles.desc}>
        <span className={styles.reason}>교정 이유</span>
        {view.description}
      </p>
      {view.blockedReason ? <p className={styles.hint}>{view.blockedReason}</p> : null}
    </article>
  );
}

function SingleChoice({ view, onApply }: { view: CardView; onApply: (optionIndex: number) => void }) {
  const [index, text] = view.choices[0];
  const applied = view.applied === index;
  return (
    <button
      type="button"
      className={styles.rec}
      aria-pressed={applied}
      title={applied ? "적용됨" : "누르면 바로 적용됩니다"}
      disabled={applied || !view.canApply}
      onClick={() => onApply(index)}
    >
      {text}
    </button>
  );
}

function MultiChoice({ view, matched, onApply }: { view: CardView; matched: string; onApply: (optionIndex: number) => void }) {
  return (
    <select
      className={styles.recSelect}
      aria-label={`${matched} 권장 표현 선택`}
      value={view.applied === null ? "" : String(view.applied)}
      data-applied={view.applied !== null || undefined}
      disabled={!view.canApply}
      onChange={(e) => {
        if (e.target.value !== "") onApply(Number(e.target.value));
      }}
    >
      <option value="" disabled>
        권장 표현 선택
      </option>
      {view.choices.map(([index, text]) => (
        <option key={index} value={index}>
          {text}
        </option>
      ))}
    </select>
  );
}
