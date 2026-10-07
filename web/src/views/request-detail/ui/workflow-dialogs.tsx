"use client";

import type { RequestDetail } from "@/entities/request";
import {
  ApproveDialog,
  AssignDialog,
  CompleteDialog,
  RecallDecisionDialog,
  RecallDialog,
  ReviseDialog,
  ScheduleDialog,
} from "@/features/request-workflow";
import type { RequestPage } from "../model/use-request-page";
import { useReviewerCandidates, type RequestWorkflow } from "../model/use-request-workflow";

/** Modal opened from a header or banner button of the request tab. */
export type WorkflowDialog =
  | { kind: "assign" }
  | { kind: "change" }
  | { kind: "due" }
  | { kind: "recall" }
  | { kind: "decide"; approve: boolean }
  | { kind: "complete" }
  | { kind: "approve" }
  | { kind: "revise" };

export interface WorkflowDialogsProps {
  page: RequestPage;
  meId: number;
  approvalEnabled: boolean;
  workflow: RequestWorkflow;
  dialog: WorkflowDialog | null;
  onClose: () => void;
  /** After a successful call (the detail is already stored). */
  onDone: (dialog: WorkflowDialog, detail: RequestDetail) => void;
}

/** Review-stage workflow modals (assignment, schedule, recall, completion, approval). */
export function WorkflowDialogs({ page, meId, approvalEnabled, workflow, dialog, onClose, onDone }: WorkflowDialogsProps) {
  const r = page.request;
  const kind = dialog?.kind ?? null;
  const candidates = useReviewerCandidates(page, kind === "assign" || kind === "change");
  const common = {
    onClose,
    request: r,
    rowVersion: workflow.rowVersion,
    onStale: () => {
      onClose();
      workflow.reload();
    },
  };
  const done = (detail: RequestDetail) => {
    workflow.applied(detail);
    if (dialog) onDone(dialog, detail);
  };
  return (
    <>
      <AssignDialog
        {...common}
        mode={kind === "assign" ? "assign" : kind === "change" ? "change" : null}
        candidates={candidates}
        onDone={done}
      />
      <ScheduleDialog {...common} open={kind === "due"} onDone={done} />
      <RecallDialog {...common} open={kind === "recall"} primaryName={page.users.name(r.primaryReviewerId)} onDone={done} />
      <RecallDecisionDialog {...common} approve={dialog?.kind === "decide" ? dialog.approve : null} onDone={done} />
      <CompleteDialog
        {...common}
        open={kind === "complete"}
        meId={meId}
        approvalEnabled={approvalEnabled}
        users={page.users}
        onDone={done}
      />
      <ApproveDialog {...common} open={kind === "approve"} onDone={done} />
      <ReviseDialog
        {...common}
        open={kind === "revise"}
        reviewerNames={r.reviewerIds.map((id) => page.users.name(id)).join(", ")}
        onDone={done}
      />
    </>
  );
}
