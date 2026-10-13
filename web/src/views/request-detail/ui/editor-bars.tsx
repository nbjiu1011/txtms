"use client";

import type { Ref } from "react";
import { Icon, LockBar, SaveIndicator, Tag } from "@/shared/ui";
import { Button, Input } from "@/shared/common";
import type { Content } from "@/entities/request";
import type { DraftSession } from "../model/draft-session";
import type { RevisionBuffer } from "../model/revision-session";
import { saveLabel } from "../model/save-label";
import styles from "./work.module.css";

export interface EditorToolbarProps {
  /** Content as shown (local edits applied). */
  content: Content;
  /** Draft: editable title input + autosave indicator + 저장. */
  draft: { session: DraftSession; server: Content; titleEditable: boolean } | null;
  /** Review: 수정본 저장 / 변경 취소 (shown when the user may edit and nobody else holds the lock). */
  revision: { buffered: boolean; saving: boolean; onSave: () => void; onDiscard: () => void } | null;
  /** 변수 삽입 is available (editable, not RCS, no foreign lock). */
  variables: { open: boolean; onToggle: () => void } | null;
  /** Anchor of the variable picker popover. */
  variablesRef?: Ref<HTMLButtonElement>;
  onCompare: () => void;
  /** Opens the writing guide; omitted for a deferred type without a guide (RCS). */
  onGuide?: () => void;
}

/** `.ed-top` — title, key/version tag, version compare, save state and editor actions. */
export function EditorToolbar({ content, draft, revision, variables, variablesRef, onCompare, onGuide }: EditorToolbarProps) {
  const state = draft?.session.saveState;
  return (
    <div className={styles.edTop}>
      {draft?.titleEditable ? (
        <Input
          className={styles.titleIn}
          aria-label="콘텐츠 제목"
          value={content.title}
          onChange={(e) => draft.session.setContentTitle(draft.server, e.target.value)}
        />
      ) : (
        <h3>{content.title}</h3>
      )}
      <Tag variant="fill">
        {content.key} v{content.version}
      </Tag>
      {content.versions.length > 1 ? (
        <Button size="sm" variant="ghost" onClick={onCompare}>
          버전 비교
        </Button>
      ) : null}
      <span className={styles.sp} />
      {draft && state ? <SaveIndicator state={state.status}>{saveLabel(state)}</SaveIndicator> : null}
      {onGuide ? (
        <Button size="sm" variant="ghost" className={styles.btnIcon} onClick={onGuide}>
          <Icon name="book" />
          가이드
        </Button>
      ) : null}
      {variables ? (
        <Button
          ref={variablesRef}
          size="sm"
          className={styles.btnIcon}
          aria-haspopup="dialog"
          aria-expanded={variables.open}
          onClick={variables.onToggle}
        >
          <Icon name="brace" />
          변수 삽입
        </Button>
      ) : null}
      {draft ? (
        <Button size="sm" onClick={() => void draft.session.flush()}>
          저장
        </Button>
      ) : null}
      {revision ? (
        <>
          <Button
            size="sm"
            variant="pri"
            disabled={!revision.buffered || revision.saving}
            aria-busy={revision.saving || undefined}
            onClick={revision.onSave}
          >
            수정본 저장
          </Button>
          {revision.buffered ? (
            <Button size="sm" variant="ghost" onClick={revision.onDiscard}>
              변경 취소
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export interface EditorLockBarsProps {
  content: Content;
  /** Name of another user holding the lock, or null. */
  lockedByName: string | null;
  /** Force release (lead / customer admin): role label shown on the button. */
  unlock: { label: string; onUnlock: () => void } | null;
  /** Read-only reason when the user may not edit (and nobody else holds the lock). */
  readOnlyReason: string | null;
  buffer: RevisionBuffer | undefined;
}

/** The three independent bars above the fields (reference `LockBar`). */
export function EditorLockBars({ content, lockedByName, unlock, readOnlyReason, buffer }: EditorLockBarsProps) {
  return (
    <>
      {lockedByName !== null ? (
        <LockBar>
          {lockedByName}님이 이 문안을 편집 중입니다. 편집이 끝나면 최신 버전으로 수정할 수 있습니다.
          {unlock ? (
            <>
              {" "}
              <Button size="sm" variant="ghost" onClick={unlock.onUnlock}>
                잠금 해제 ({unlock.label})
              </Button>
            </>
          ) : null}
        </LockBar>
      ) : null}
      {readOnlyReason !== null && lockedByName === null ? <LockBar neutral>{readOnlyReason}</LockBar> : null}
      {buffer ? (
        <LockBar>
          v{buffer.base}을 기준으로 수정 중입니다. 저장하면 v{content.version + 1}이 만들어지고 히스토리에 남습니다.
          {buffer.lock.status === "lost"
            ? " 편집 잠금이 해제되어 이 수정본은 저장할 수 없습니다. 변경 취소 후 최신 버전으로 다시 수정하세요."
            : null}
        </LockBar>
      ) : null}
    </>
  );
}
