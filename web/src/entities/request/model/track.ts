import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from "./labels";
import type { RequestStatus, StageTimes } from "./types";

export type TrackStage = "DRAFT" | "WAITING" | "IN_REVIEW" | "APPROVAL_WAITING" | "APPROVED" | "REVIEW_COMPLETED";

export interface TrackStepModel {
  stage: TrackStage;
  label: string;
  state: "past" | "current" | "future";
  /** Status tone of the step node (`--s-*` key). */
  tone: "draft" | "wait" | "review" | "ask" | "appr" | "done";
  /** "확인 요청 n회" on the review step when the request had asks. */
  loop: string | null;
  /** Last time the stage was reached (shown up to the current step). */
  reachedAt: string | null;
}

const STAGE_TIME_KEY: Record<TrackStage, keyof StageTimes> = {
  DRAFT: "DRAFT",
  WAITING: "WAITING",
  IN_REVIEW: "IN_REVIEW",
  APPROVAL_WAITING: "COMPLETED",
  REVIEW_COMPLETED: "COMPLETED",
  APPROVED: "APPROVED",
};

/** Steps of the lifecycle track: with approval `… → 승인 대기 → 승인 완료`, otherwise `… → 검수 완료`. */
export function trackStages(approvalEnabled: boolean): TrackStage[] {
  return approvalEnabled
    ? ["DRAFT", "WAITING", "IN_REVIEW", "APPROVAL_WAITING", "APPROVED"]
    : ["DRAFT", "WAITING", "IN_REVIEW", "REVIEW_COMPLETED"];
}

/**
 * Status track of a request (reference `vTrack`). 확인 요청 sits on the review step, labelled
 * "확인 요청 중" in the ask tone.
 */
export function buildTrack(input: {
  status: RequestStatus;
  approvalEnabled: boolean;
  stageTimes: StageTimes;
  askCount: number;
}): TrackStepModel[] {
  const stages = trackStages(input.approvalEnabled);
  const current: TrackStage = input.status === "CONFIRMING" ? "IN_REVIEW" : (input.status as TrackStage);
  const currentIndex = stages.indexOf(current);
  const asking = input.status === "CONFIRMING";
  return stages.map((stage, i) => {
    const onReview = stage === "IN_REVIEW";
    return {
      stage,
      label: asking && onReview ? "확인 요청 중" : REQUEST_STATUS_LABEL[stage],
      state: i < currentIndex ? "past" : i === currentIndex ? "current" : "future",
      tone: asking && onReview ? "ask" : REQUEST_STATUS_TONE[stage],
      loop: onReview && input.askCount > 0 ? `확인 요청 ${input.askCount}회` : null,
      reachedAt: i <= currentIndex ? input.stageTimes[STAGE_TIME_KEY[stage]] : null,
    };
  });
}
