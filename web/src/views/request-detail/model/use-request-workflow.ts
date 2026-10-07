"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateRequestViews,
  performableActions,
  requestKeys,
  storeRequestDetail,
  type RequestAction,
  type RequestDetail,
} from "@/entities/request";
import { useWorkload } from "@/entities/dashboard";
import type { ReviewerCandidate, UnlockDialogProps } from "@/features/request-workflow";
import type { ThreadActions, UnlockAction } from "./workflow-types";
import type { RequestPage } from "./use-request-page";
import type { RevisionEditing } from "./use-revision-editing";

export interface RequestWorkflow {
  performable: ReadonlySet<RequestAction>;
  /** Current `rowVersion` (read at call time: autosave and polling may have changed it). */
  rowVersion: () => number;
  /** Stores a detail returned by a workflow call and refreshes lists, dashboards and history. */
  applied: (detail: RequestDetail) => void;
  reload: () => void;
  thread: ThreadActions;
  unlock: UnlockAction | null;
  unlockDialog: Pick<UnlockDialogProps, "target" | "onClose" | "onDone">;
}

/** Workflow plumbing shared by the request tab and the single-content tab. */
export function useRequestWorkflow(page: RequestPage, meId: number, revision: RevisionEditing): RequestWorkflow {
  const client = useQueryClient();
  const r = page.request;
  const id = r.id;
  const [unlockTarget, setUnlockTarget] = useState<UnlockDialogProps["target"]>(null);
  const performable = performableActions(r.allowedActions);
  const rowVersion = () => client.getQueryData<RequestDetail>(requestKeys.detail(id))?.rowVersion ?? r.rowVersion;
  const reload = () => void client.invalidateQueries({ queryKey: requestKeys.detail(id) });
  const applied = (detail: RequestDetail) => {
    storeRequestDetail(client, detail);
    invalidateRequestViews(client, id);
  };
  const isLead = page.project?.leadUserId === meId || r.leadUserId === meId;

  return {
    performable,
    rowVersion,
    applied,
    reload,
    thread: {
      performable,
      rowVersion,
      onDone: applied,
      onStale: reload,
      unsavedReason: (step) => revision.unsavedReason(step),
    },
    unlock: performable.has("UNLOCK")
      ? {
          label: isLead ? "대표 검수자" : "고객사 관리자",
          onUnlock: (contentKey, holderId) =>
            setUnlockTarget({ requestId: id, contentKey, holderName: page.users.name(holderId) }),
        }
      : null,
    unlockDialog: { target: unlockTarget, onClose: () => setUnlockTarget(null), onDone: reload },
  };
}

/**
 * Reviewers the lead can assign: active project reviewers except the requester, with their active
 * request count (`활성 n건`) from the project workload.
 */
export function useReviewerCandidates(page: RequestPage, enabled: boolean): ReviewerCandidate[] {
  const workload = useWorkload(page.request.projectId, enabled);
  const { project, users, request } = page;
  return useMemo(() => {
    const active = new Map((workload.data ?? []).map((w) => [w.userId, w.active]));
    return (project?.members ?? [])
      .filter((m) => m.roles.includes("REVIEWER") && m.userId !== request.requesterId)
      .map((m) => users.get(m.userId))
      .filter((u): u is NonNullable<typeof u> => !!u && u.active)
      .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatarColor, activeCount: active.get(u.id) ?? 0 }));
  }, [workload.data, project, users, request.requesterId]);
}
