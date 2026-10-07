"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/entities/project";
import type { ContentPayload } from "@/entities/request";
import {
  useCorrection,
  useCorrectionHandoff,
  type CorrectionController,
  type CorrectionEditor,
  type RevealTarget,
} from "@/features/text-correction";
import type { DraftEditing } from "./use-draft-editing";
import type { RequestPage } from "./use-request-page";
import type { RevisionEditing } from "./use-revision-editing";

/** A pending "show this range in the editor" (consumed by the work grid once that content is shown). */
export interface PendingReveal extends RevealTarget {
  seq: number;
}

export interface RequestCorrection {
  controller: CorrectionController;
  reveal: PendingReveal | null;
  onRevealed: () => void;
}

export interface UseRequestCorrectionOptions {
  page: RequestPage;
  meId: number;
  editing: DraftEditing;
  revision: RevisionEditing;
  /** Content tab: its content key (other contents are shown in their own tab); request tab: null. */
  ownKey: string | null;
  /** Request tab: shows another content in the editor. */
  onSelectContent?: (key: string) => void;
  /** Content tab: opens the tab of another content. */
  onOpenContent?: (key: string) => void;
}

/**
 * Binds the correction panel to this tab's editing: drafts are edited through the autosaving draft
 * session (author only), review-time edits through the revision buffer (lock first).
 */
export function useRequestCorrection(options: UseRequestCorrectionOptions): RequestCorrection {
  const { page, meId, editing, revision, ownKey } = options;
  const client = useQueryClient();
  const r = page.request;
  const draft = r.status === "DRAFT";
  const [reveal, setReveal] = useState<PendingReveal | null>(null);
  const serverOf = (key: string) => r.contents.find((c) => c.key === key);

  const editor: CorrectionEditor = {
    payloadOf: (key) => {
      const server = serverOf(key);
      if (!server) return null;
      return (draft ? editing.session.content(server) : revision.session.content(server)).payload;
    },
    canEdit: (key) => {
      const server = serverOf(key);
      if (!server || (ownKey !== null && key !== ownKey)) return false;
      if (draft) return editing.canEditContent;
      if (!revision.canEdit) return false;
      if (server.lock && server.lock.userId !== meId) return false;
      return revision.session.buffer(key)?.lock.status !== "lost";
    },
    begin: (key) => {
      const server = serverOf(key);
      if (!server) return Promise.resolve(false);
      return draft ? Promise.resolve(true) : revision.session.begin(server);
    },
    write: (key, payload: ContentPayload) => {
      const server = serverOf(key);
      if (!server) return;
      if (draft) editing.session.setPayload(server, payload);
      else revision.session.setPayload(server, payload);
    },
  };

  const controller = useCorrection({
    requestId: r.id,
    type: r.type,
    contents: r.contents.map((c) => ({
      key: c.key,
      title: draft ? editing.session.content(c).title : c.title,
      fileCount: c.files.length,
    })),
    variablesRevision: page.project?.variablesRevision ?? null,
    editor,
    adoptFor: ownKey ?? undefined,
    onVariablesAhead: () => void client.invalidateQueries({ queryKey: projectKeys.detail(r.projectId) }),
    onReveal: (target, run) => {
      if (ownKey !== null && target.key !== ownKey) {
        useCorrectionHandoff.getState().put(r.id, target.key, { run, groupId: target.groupId });
        options.onOpenContent?.(target.key);
        return;
      }
      if (ownKey === null) options.onSelectContent?.(target.key);
      setReveal((prev) => ({ ...target, seq: (prev?.seq ?? 0) + 1 }));
    },
  });

  return { controller, reveal, onRevealed: () => setReveal(null) };
}
