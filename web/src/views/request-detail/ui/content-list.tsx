"use client";

import { cn } from "@/shared/lib";
import { Button, Icon } from "@/shared/ui";
import { ContentTypeChip, type Content, type RequestDetail } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./work.module.css";

/** Footer actions of a draft's content list (reference `.clist-f`). */
export interface ContentListActions {
  onAdd: () => void;
  /** Present for 알림톡·문자 only. */
  onBulk?: () => void;
  /** Present when 2+ contents (deletes the selected one). */
  onDeleteSelected?: () => void;
}

export interface ContentListProps {
  request: Pick<RequestDetail, "type" | "status" | "contents">;
  /** Titles as edited locally. */
  titleOf: (content: Content) => string;
  /** Contents with an unsaved review-time revision in this tab (`수정 중`). */
  editingKeys?: readonly string[];
  users: UserDirectory;
  meId: number;
  selected: string;
  onSelect: (key: string) => void;
  onOpen: (key: string) => void;
  actions?: ContentListActions;
}

/** `aside.clist` — content items (version, files, edit lock) and the draft footer actions. */
export function ContentList(props: ContentListProps) {
  const { request: r, titleOf, editingKeys = [], users, meId, selected, onSelect, onOpen, actions } = props;
  return (
    <aside className={styles.clist} aria-label="콘텐츠 목록">
      <div className={styles.clistH}>
        <ContentTypeChip type={r.type} size="sm" />
        콘텐츠 {r.contents.length}건
      </div>
      {r.contents.map((c) => (
        <ContentItem
          key={c.key}
          content={c}
          title={titleOf(c)}
          editing={editingKeys.includes(c.key)}
          on={c.key === selected}
          lockedBy={r.status !== "DRAFT" && c.lock && c.lock.userId !== meId ? users.name(c.lock.userId) : null}
          onSelect={() => onSelect(c.key)}
          onOpen={() => onOpen(c.key)}
        />
      ))}
      {actions ? (
        <div className={styles.clistF}>
          <Button size="sm" onClick={actions.onAdd}>
            <Icon name="plus" />
            콘텐츠 추가
          </Button>
          {actions.onBulk ? (
            <Button size="sm" onClick={actions.onBulk}>
              XLSX 대량 등록
            </Button>
          ) : null}
          {actions.onDeleteSelected ? (
            <Button size="sm" variant="ghost" onClick={actions.onDeleteSelected}>
              선택 콘텐츠 삭제
            </Button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function ContentItem(props: {
  content: Content;
  title: string;
  editing: boolean;
  on: boolean;
  lockedBy: string | null;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { content: c, title, editing, on, lockedBy, onSelect, onOpen } = props;
  // The row is clickable as a whole, but only its key + title part is the (pressable) button: the 새 탭
  // button next to it must not be nested inside another interactive element.
  return (
    <div className={cn(styles.citem, on && styles.on)} onClick={onSelect}>
      <span
        role="button"
        tabIndex={0}
        aria-pressed={on}
        className={styles.citemMain}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <span className={styles.no}>{c.key}</span>
        <span className={styles.ct}>
          <b>{title}</b>
          <span>
            v{c.version}
            {c.files.length ? `  파일 ${c.files.length}` : ""}
            {editing ? "  수정 중" : ""}
          </span>
          {lockedBy ? <span className={styles.lk}>{lockedBy} 편집 중</span> : null}
        </span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        className={styles.openC}
        title="새 탭으로 열기"
        aria-label={`${c.key} 새 탭으로 열기`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <Icon name="ext" />
      </Button>
    </div>
  );
}
