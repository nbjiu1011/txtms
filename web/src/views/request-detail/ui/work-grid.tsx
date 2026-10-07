"use client";

import { useState } from "react";
import { cn } from "@/shared/lib";
import { Button, Empty, Icon, LockBar, Tag } from "@/shared/ui";
import { ContentTypeChip, canEditContentByPolicy, readOnlyReason, type Content } from "@/entities/request";
import type { RequestPage } from "../model/use-request-page";
import { ContentEditor } from "./content-editor";
import { GuideDrawer } from "./guide-drawer";
import { SidePanel, type SidePanelTab } from "./side-panel";
import { VersionCompareModal } from "./version-compare-modal";
import styles from "./work.module.css";

export interface WorkGridProps {
  page: RequestPage;
  meId: number;
  /** Selected content key (falls back to the first content). */
  contentKey: string | null;
  onSelectContent: (key: string) => void;
  /** Single-content tab: no content list, two columns. */
  single?: boolean;
  sideTab: SidePanelTab;
  onSideTab: (tab: SidePanelTab) => void;
  onOpenContent: (key: string) => void;
}

/** `.work` — content list, read-only editor and side panel (reference `vWork`). */
export function WorkGrid(props: WorkGridProps) {
  const { page, meId, contentKey, onSelectContent, single, sideTab, onSideTab, onOpenContent } = props;
  const r = page.request;
  const [guideOpen, setGuideOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const content = r.contents.find((c) => c.key === contentKey) ?? r.contents[0];
  if (!content) return <Empty title="콘텐츠가 없습니다" />;

  const lockedBy = r.status !== "DRAFT" && content.lock && content.lock.userId !== meId ? content.lock.userId : null;
  const policyEditable = canEditContentByPolicy(r, meId);

  return (
    <div className={cn(styles.work, single && styles.single)}>
      {single ? null : (
        <ContentList page={page} meId={meId} selected={content.key} onSelect={onSelectContent} onOpen={onOpenContent} />
      )}
      <section className={styles.editor} aria-label="콘텐츠 편집">
        <div className={styles.edTop}>
          <h3>{content.title}</h3>
          <Tag variant="fill">
            {content.key} v{content.version}
          </Tag>
          {content.versions.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setCompareOpen(true)}>
              버전 비교
            </Button>
          ) : null}
          <span className={styles.sp} />
          <Button size="sm" variant="ghost" className={styles.btnIcon} onClick={() => setGuideOpen(true)}>
            <Icon name="book" />
            가이드
          </Button>
        </div>
        {lockedBy !== null ? (
          <LockBar>
            {page.users.name(lockedBy)}님이 이 문안을 편집 중입니다. 편집이 끝나면 최신 버전으로 수정할 수 있습니다.
          </LockBar>
        ) : null}
        {!policyEditable && lockedBy === null ? <LockBar neutral>{readOnlyReason(r, meId)}</LockBar> : null}
        <ContentEditor requestId={r.id} type={r.type} content={content} project={page.project} disabled />
      </section>
      <SidePanel page={page} content={content} meId={meId} tab={sideTab} onTab={onSideTab} />
      <GuideDrawer type={r.type} open={guideOpen} onClose={() => setGuideOpen(false)} />
      <VersionCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        requestId={r.id}
        type={r.type}
        content={content}
        users={page.users}
      />
    </div>
  );
}

interface ContentListProps {
  page: RequestPage;
  meId: number;
  selected: string;
  onSelect: (key: string) => void;
  onOpen: (key: string) => void;
}

function ContentList({ page, meId, selected, onSelect, onOpen }: ContentListProps) {
  const r = page.request;
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
          on={c.key === selected}
          lockedBy={r.status !== "DRAFT" && c.lock && c.lock.userId !== meId ? page.users.name(c.lock.userId) : null}
          onSelect={() => onSelect(c.key)}
          onOpen={() => onOpen(c.key)}
        />
      ))}
    </aside>
  );
}

function ContentItem(props: {
  content: Content;
  on: boolean;
  lockedBy: string | null;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { content: c, on, lockedBy, onSelect, onOpen } = props;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={on}
      className={cn(styles.citem, on && styles.on)}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={styles.no}>{c.key}</span>
      <span className={styles.ct}>
        <b>{c.title}</b>
        <span>
          v{c.version}
          {c.files.length ? `  파일 ${c.files.length}` : ""}
        </span>
        {lockedBy ? <span className={styles.lk}>{lockedBy} 편집 중</span> : null}
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
