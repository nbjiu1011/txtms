import type { RequestAction, RequestDetail } from "@/entities/request";

/** Workflow wiring of the opinion / ask / answer forms of the side panel. */
export interface ThreadActions {
  performable: ReadonlySet<RequestAction>;
  rowVersion: () => number;
  onDone: (detail: RequestDetail) => void;
  onStale: () => void;
  /** Message blocking the step while a revision is unsaved. */
  unsavedReason: (step: "ask" | "answer") => string | null;
}

/** Force release of another user's edit lock (대표 검수자 · 고객사 관리자). */
export interface UnlockAction {
  /** `대표 검수자` or `고객사 관리자` (button label). */
  label: string;
  onUnlock: (contentKey: string, holderId: number) => void;
}
