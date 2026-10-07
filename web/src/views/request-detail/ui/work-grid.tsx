"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { Empty, Modal } from "@/shared/ui";
import {
  canEditContentByPolicy,
  invalidateRequestViews,
  readOnlyReason,
  storeRequestDetail,
  type FileMeta,
} from "@/entities/request";
import { BULK_TYPES, BulkImportModal } from "@/features/bulk-import";
import { selectRange } from "@/features/text-correction";
import { VariablePicker } from "@/features/variable-picker";
import type { FileRangeDraft } from "../model/file-range";
import type { DraftEditing } from "../model/use-draft-editing";
import type { RequestPage } from "../model/use-request-page";
import type { RequestCorrection } from "../model/use-request-correction";
import type { RevisionEditing } from "../model/use-revision-editing";
import { useVariableInsertion } from "../model/use-variable-insertion";
import { ContentEditor } from "./content-editor";
import { ContentList } from "./content-list";
import { EditorLockBars, EditorToolbar } from "./editor-bars";
import { GuideDrawer } from "./guide-drawer";
import type { ThreadActions, UnlockAction } from "../model/workflow-types";
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
  /** Draft editing of this tab (null: no draft editing). */
  editing: DraftEditing | null;
  /** Review-time editing (buffer + edit lock) of this tab. */
  revision: RevisionEditing | null;
  unlock?: UnlockAction | null;
  /** Opinion / ask / answer forms of the side panel. */
  thread?: ThreadActions | null;
  /** Text correction of this tab (results, apply/restore, pending editor selection). */
  correction?: RequestCorrection;
}

/** `.work` — content list, editor and side panel (reference `vWork`). */
export function WorkGrid(props: WorkGridProps) {
  const { page, meId, contentKey, onSelectContent, single, sideTab, onSideTab, onOpenContent, editing, revision } = props;
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
  const reveal = props.correction?.reveal ?? null;
  const onRevealed = props.correction?.onRevealed;
  const shownKey = server?.key;
  // A correction card asked to show its expression: select it once that content is in the editor.
  useEffect(() => {
    if (!reveal || reveal.key !== shownKey) return;
    const frame = requestAnimationFrame(() => {
      selectRange(editorRef.current, reveal.field, reveal.start, reveal.end);
      onRevealed?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [reveal, shownKey, onRevealed]);
  if (!server) return <Empty title="콘텐츠가 없습니다" />;
  const draftMode = r.status === "DRAFT";
  const session = draftMode ? (editing?.session ?? null) : null;
  const rev = draftMode ? null : revision;
  const payloadEditor = session ?? rev?.session ?? null;
  const content = payloadEditor ? payloadEditor.content(server) : server;

  const lockedBy = !draftMode && content.lock && content.lock.userId !== meId ? content.lock.userId : null;
  const policyEditable = canEditContentByPolicy(r, meId);
  const editable = draftMode ? !!editing?.canEditContent : !!rev?.canEdit;
  const writable = editable && lockedBy === null;
  const buffer = rev?.session.buffer(server.key);
  const listActions = draftMode && editing?.canEditRequest
    ? {
        onAdd: () =>
          void editing.addContent().then((key) => {
            if (key) onSelectContent(key);
          }),
        onBulk: BULK_TYPES.includes(r.type) ? () => setBulkOpen(true) : undefined,
        onDeleteSelected: r.contents.length > 1 ? () => setDeleteOpen(true) : undefined,
      }
    : undefined;

  const attachments = (() => {
    if (session && editing && writable) {
      return {
        range: (file: FileMeta) => session.fileRange(file),
        onRange: (file: FileMeta, next: FileRangeDraft) => session.setFileRange(server.key, file.id, next),
        onUpload: (files: File[]) => editing.uploadFiles(server, files),
        onDelete: (file: FileMeta) => editing.deleteFile(server, file),
        uploads: editing.uploads,
        busy: editing.uploadBusy,
      };
    }
    if (rev && writable) {
      return {
        range: (file: FileMeta) => rev.session.fileRange(server.key, file),
        onRange: (file: FileMeta, next: FileRangeDraft) => rev.session.setFileRange(server, file, next),
        busy: false,
        onUploadVersion: rev.canUploadFileVersions
          ? (file: FileMeta, picked: File) => rev.uploadFileVersion(server, file, picked)
          : undefined,
        versionBusy: rev.fileVersionBusy,
      };
    }
    return undefined;
  })();

  const images = (() => {
    if (draftMode && editing && writable) {
      return {
        busyIndex: editing.imageBusy?.key === server.key ? editing.imageBusy.index : null,
        upload: (index: number, file: File) => editing.uploadImage(server, index, file),
      };
    }
    if (rev && writable) {
      return {
        busyIndex: rev.imageBusy?.key === server.key ? rev.imageBusy.index : null,
        upload: (index: number, file: File) => rev.uploadImage(server, index, file),
      };
    }
    return undefined;
  })();

  return (
    <div className={cn(styles.work, single && styles.single)}>
      {single ? null : (
        <ContentList
          request={r}
          titleOf={(c) => (session ? session.content(c).title : c.title)}
          editingKeys={rev ? rev.session.keys() : []}
          users={page.users}
          meId={meId}
          selected={server.key}
          onSelect={onSelectContent}
          onOpen={onOpenContent}
          actions={listActions}
        />
      )}
      <section ref={editorRef} className={styles.editor} aria-label="콘텐츠 편집" {...variables.handlers}>
        <EditorToolbar
          content={content}
          draft={session && editable ? { session, server, titleEditable: !!editing?.canEditRequest } : null}
          revision={
            rev && writable
              ? {
                  buffered: !!buffer,
                  saving: rev.saving === server.key,
                  onSave: () => rev.save(server),
                  onDiscard: () => rev.discard(server.key),
                }
              : null
          }
          variables={
            writable && r.type !== "RCS"
              ? { open: varOpen, onToggle: () => setVarOpen((v) => !v) }
              : null
          }
          variablesRef={setVarAnchor}
          onCompare={() => setCompareOpen(true)}
          onGuide={() => setGuideOpen(true)}
        />
        <EditorLockBars
          content={content}
          lockedByName={lockedBy === null ? null : page.users.name(lockedBy)}
          unlock={
            lockedBy !== null && props.unlock
              ? { label: props.unlock.label, onUnlock: () => props.unlock?.onUnlock(server.key, lockedBy) }
              : null
          }
          readOnlyReason={policyEditable ? null : readOnlyReason(r, meId)}
          buffer={buffer}
        />
        <ContentEditor
          requestId={r.id}
          type={r.type}
          content={content}
          project={page.project}
          disabled={!writable}
          onPayload={payloadEditor && writable ? (payload) => payloadEditor.setPayload(server, payload) : undefined}
          attachments={attachments}
          images={images}
        />
      </section>
      <SidePanel
        page={page}
        content={content}
        meId={meId}
        tab={sideTab}
        onTab={onSideTab}
        thread={props.thread ?? null}
        correction={props.correction?.controller ?? null}
      />
      <GuideDrawer type={r.type} open={guideOpen} onClose={() => setGuideOpen(false)} />
      <VersionCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        requestId={r.id}
        type={r.type}
        content={content}
        users={page.users}
      />
      {payloadEditor && writable ? (
        <VariablePicker
          open={varOpen}
          anchor={varAnchor}
          onClose={() => setVarOpen(false)}
          projectId={r.projectId}
          projectName={page.project?.name ?? ""}
          onInsert={(key) => variables.insert(payloadEditor, server, r.type, key)}
        />
      ) : null}
      {draftMode && editing ? (
        <>
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
