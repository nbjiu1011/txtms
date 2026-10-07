import type { CoReviewer, RequestDetail } from "@/entities/request";

export type CompleteCheck =
  /** Do not call the server: show `message`. */
  | { kind: "blocked"; message: string }
  /** No eligible approver: call `complete` anyway so the server records the block and notifies. */
  | { kind: "noApprover" }
  | { kind: "confirm" };

export const UNSAVED_REVISION_BEFORE_COMPLETE = "저장하지 않은 수정본이 있습니다. 먼저 저장하세요";
export const LOCKED_BEFORE_COMPLETE = "다른 검수자가 편집 중입니다. 저장과 잠금 해제 후 완료하세요";

/** Checks before the 검수 완료 confirmation, in the reference order (`complete` + plan overrides). */
export function checkBeforeComplete(
  r: Pick<RequestDetail, "contents" | "eligibleApproverIds">,
  ctx: { meId: number; approvalEnabled: boolean; hasUnsavedRevision: boolean },
): CompleteCheck {
  if (ctx.approvalEnabled && r.eligibleApproverIds.length === 0) return { kind: "noApprover" };
  if (r.contents.some((c) => c.lock && c.lock.userId !== ctx.meId)) return { kind: "blocked", message: LOCKED_BEFORE_COMPLETE };
  if (ctx.hasUnsavedRevision) return { kind: "blocked", message: UNSAVED_REVISION_BEFORE_COMPLETE };
  return { kind: "confirm" };
}

/** Role label after a name in "공동 검수 결과" (reference `  (주담당)` / `  (이전 담당)`). */
export function coReviewerRole(c: Pick<CoReviewer, "primary" | "current">): string {
  if (c.primary) return "(주담당)";
  if (!c.current) return "(이전 담당)";
  return "";
}

/** `검수 의견 n건`, with the per-round split when opinions span several rounds. */
export function coReviewerOpinions(c: Pick<CoReviewer, "opinionCount" | "rounds">): string {
  const base = `검수 의견 ${c.opinionCount}건`;
  if (c.rounds.length < 2) return base;
  return `${base} · ${c.rounds.map((r) => `${r.round}차 ${r.count}건`).join(", ")}`;
}
