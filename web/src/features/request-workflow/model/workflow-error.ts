import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";

/** Reference text when a confirmed action is no longer allowed (role or state changed meanwhile). */
export const STATE_CHANGED_MESSAGE = "권한 또는 요청 상태가 변경되었습니다";

/** Codes after which the screen must reload the request (someone else changed it). */
const STALE_CODES = new Set(["REQUEST_STATE_CONFLICT", "NO_ELIGIBLE_APPROVER", "LOCKED_BY_OTHER", "VERSION_CONFLICT"]);

export type WorkflowErrorOutcome = "keepOpen" | "close";

/**
 * Shows a failed workflow call the reference way (toast) and tells the modal what to do:
 * input problems keep it open, a changed request closes it and reloads (`onStale`).
 */
export function handleWorkflowError(error: unknown, onStale: () => void, fallback = "요청을 처리하지 못했습니다"): WorkflowErrorOutcome {
  if (!isApiError(error)) {
    toast(error instanceof Error && error.message ? error.message : fallback);
    return "keepOpen";
  }
  if (error.code === "REQUEST_STATE_CONFLICT") {
    toast(STATE_CHANGED_MESSAGE);
    onStale();
    return "close";
  }
  toast(error.message || fallback);
  if (STALE_CODES.has(error.code) || error.status === 403 || error.status === 404) {
    onStale();
    return "close";
  }
  return "keepOpen";
}

/** Modal `onOk` result for an outcome: `false` keeps the modal open. */
export const modalResult = (outcome: WorkflowErrorOutcome): false | undefined => (outcome === "keepOpen" ? false : undefined);
