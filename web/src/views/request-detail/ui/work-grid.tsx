"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { Button, Empty, Icon, Input, LockBar, Modal, SaveIndicator, Tag } from "@/shared/ui";
import {
  canEditContentByPolicy,
  invalidateRequestViews,
  readOnlyReason,
  storeRequestDetail,
} from "@/entities/request";
import { BULK_TYPES, BulkImportModal } from "@/features/bulk-import";
import { VariablePicker } from "@/features/variable-picker";
import type { DraftEditing } from "../model/use-draft-editing";
import type { RequestPage } from "../model/use-request-page";
import { saveLabel } from "../model/save-label";
import { useVariableInsertion } from "../model/use-variable-insertion";
import { ContentEditor } from "./content-editor";
import { ContentList } from "./content-list";
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
  /** Draft editing of this tab (null: read-only). */
  editing: DraftEditing | null;
}

/** `.work` — content list, editor and side panel (reference `vWork`). */
export function WorkGrid(props: WorkGridProps) {
  const { page, meId, contentKey, onSelectContent, single, sideTab, onSideTab, onOpenContent, editing } = props;
  const r = page.request;
  const client = useQueryClient();
  const [guideOpen, setGuideOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [varAnchor, setVarAnchor] = useState<HTMLButtonElement | null>(null);
  const [varOpen, setVarOpen] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const variables = useVariableInsertion(editorRef);

  const server = r.contents.find((c) => c.key === contentKey) ?? r.contents[0];
  if (!server) return <Empty title="콘텐츠가 없습니다" />;
  const session = editing?.session ?? null;
  const content = session ? session.content(server) : server;

  const lockedBy = r.status !== "DRAFT" && content.lock && content.lock.userId !== meId ? content.lock.userId : null;
  const policyEditable = canEditContentByPolicy(r, meId);
  const editable = !!editing?.canEditContent;
  const listActions = editing?.canEditRequest
    ? {
        onAdd: () =>
          void editing.addContent().then((key) => {
            if (key) onSelectContent(key);
          }),
        onBulk: BULK_TYPES.includes(r.type) ? () => setBulkOpen(true) : undefined,
        onDeleteSelected: r.contents.length > 1 ? () => setDeleteOpen(true) : undefined,
      }
    : undefined;

  const state = session?.saveState;
  return (
    <div className={cn(styles.work, single && styles.single)}>
      {single ? null : (
        <ContentList
          request={r}
          titleOf={(c) => (session ? session.content(c).title : c.title)}
          users={page.users}
          meId={meId}
          selected={server.key}
          onSelect={onSelectContent}
          onOpen={onOpenContent}
          actions={listActions}
        />
      )}
      <section
        ref={editorRef}
        className={styles.editor}
        aria-label="콘텐츠 편집"
        {...variables.handlers}
      >
        <div className={styles.edTop}>
          {editable && editing?.canEditRequest && session ? (
            <Input
              className={styles.titleIn}
              aria-label="콘텐츠 제목"
              value={content.title}
              onChange={(e) => session.setContentTitle(server, e.target.value)}
            />
          ) : (
            <h3>{content.title}</h3>
          )}
          <Tag variant="fill">
            {content.key} v{content.version}
          </Tag>
          {content.versions.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setCompareOpen(true)}>
              버전 비교
            </Button>
          ) : null}
          <span className={styles.sp} />
          {editable && state ? <SaveIndicator state={state.status}>{saveLabel(state)}</SaveIndicator> : null}
          <Button size="sm" variant="ghost" className={styles.btnIcon} onClick={() => setGuideOpen(true)}>
            <Icon name="book" />
            가이드
          </Button>
          {editable && r.type !== "RCS" ? (
            <Button
              ref={setVarAnchor}
              size="sm"
              className={styles.btnIcon}
              aria-haspopup="dialog"
              aria-expanded={varOpen}
              onClick={() => setVarOpen((v) => !v)}
            >
              <Icon name="brace" />
              변수 삽입
            </Button>
          ) : null}
          {editable && session ? (
            <Button size="sm" onClick={() => void session.flush()}>
              저장
            </Button>
          ) : null}
        </div>
        {lockedBy !== null ? (
          <LockBar>
            {page.users.name(lockedBy)}님이 이 문안을 편집 중입니다. 편집이 끝나면 최신 버전으로 수정할 수 있습니다.
          </LockBar>
        ) : null}
        {!policyEditable && lockedBy === null ? <LockBar neutral>{readOnlyReason(r, meId)}</LockBar> : null}
        <ContentEditor
          requestId={r.id}
          type={r.type}
          content={content}
          project={page.project}
          disabled={!editable}
          onPayload={session && editable ? (payload) => session.setPayload(server, payload) : undefined}
          attachments={
            editing && session && editable
              ? {
                  range: (file) => session.fileRange(file),
                  onRange: (file, next) => session.setFileRange(server.key, file.id, next),
                  onUpload: (files) => editing.uploadFiles(server, files),
                  onDelete: (file) => editing.deleteFile(server, file),
                  uploads: editing.uploads,
                  busy: editing.uploadBusy,
                }
              : undefined
          }
          images={
            editing && editable
              ? {
                  busyIndex: editing.imageBusy?.key === server.key ? editing.imageBusy.index : null,
                  upload: (index, file) => editing.uploadImage(server, index, file),
                }
              : undefined
          }
        />
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
      {editing ? (
        <>
          <VariablePicker
            open={varOpen}
            anchor={varAnchor}
            onClose={() => setVarOpen(false)}
            projectId={r.projectId}
            projectName={page.project?.name ?? ""}
            onInsert={(key) => session && variables.insert(session, server, r.type, key)}
          />
          <Modal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title={`${server.key} ${content.title}을(를) 삭제할까요?`}
            description="작성 중 요청에서만 삭제할 수 있습니다."
            okLabel="삭제"
            okVariant="warn"
            onOk={async () => {
              const ok = await editing.deleteContent(server.key);
              if (ok) onSelectContent(r.contents.find((c) => c.key !== server.key)?.key ?? "");
            }}
          />
          <BulkImportModal
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            requestId={r.id}
            type={r.type}
            onApplied={(detail) => {
              storeRequestDetail(client, detail);
              invalidateRequestViews(client, r.id);
              const last = detail.contents[detail.contents.length - 1];
              if (last) onSelectContent(last.key);
              setBulkOpen(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
