import { formatDateTime } from "@/shared/lib";
import { FINAL_STATUSES, REQUEST_STATUS_LABEL, type RequestDetail } from "@/entities/request";
import { type BannerTone } from "@/shared/ui";

export type BannerAction = "answer" | "decideRecall" | "showResult";

export interface BannerModel {
  key: string;
  tone: BannerTone;
  title: string;
  /** Body lines (rendered with line breaks). */
  lines: string[];
  action: BannerAction | null;
}

export interface BannerContext {
  meId: number;
  /** The user has the APPROVER role in the request's project. */
  meIsApprover: boolean;
  name: (userId: number | null | undefined) => string;
}

type BannerRequest = Pick<
  RequestDetail,
  | "status"
  | "requesterId"
  | "recallRequested"
  | "recall"
  | "reviewerIds"
  | "primaryReviewerId"
  | "eligibleApproverIds"
  | "allowedActions"
  | "bundle"
>;

/**
 * Banners of the request body, evaluated top to bottom and stacked (reference `vBanners`).
 * Permission-dependent variants follow `allowedActions`.
 */
export function selectBanners(r: BannerRequest, ctx: BannerContext): BannerModel[] {
  const out: BannerModel[] = [];
  const mine = r.requesterId === ctx.meId;
  const add = (key: string, tone: BannerTone, title: string, lines: string[], action: BannerAction | null = null) =>
    out.push({ key, tone, title, lines, action });

  if (r.status === "DRAFT" && mine) {
    add("draft", "info", "검수 요청 전입니다", [
      "입력 내용은 자동 저장됩니다. 필수 항목을 모두 채우면 검수를 요청할 수 있습니다. 텍스트 교정은 선택 사항입니다.",
    ]);
  }
  if (r.status === "WAITING") {
    add("wait", "wait", "대표 검수자의 배정을 기다리고 있습니다", [
      mine
        ? "검수자가 배정되기 전에는 요청을 바로 취소할 수 있습니다."
        : "대표 검수자가 검수자와 주담당을 지정하면 검수가 시작됩니다.",
    ]);
  }
  if (r.status === "CONFIRMING") {
    if (mine) {
      add(
        "ask",
        "ask",
        "검수자가 확인을 요청했습니다",
        ["답변을 보내면 검수가 다시 시작됩니다. 답변하는 동안 본인 콘텐츠를 수정할 수 있습니다."],
        "answer",
      );
    } else {
      add("ask", "ask", "요청자 답변을 기다리고 있습니다", [
        "확인 요청 중에는 요청 전체의 검수가 멈추고, 회수 요청과 검수자 변경을 할 수 없습니다.",
      ]);
    }
  }
  if (r.recallRequested && r.status === "IN_REVIEW") {
    if (r.allowedActions.includes("DECIDE_RECALL")) {
      add(
        "recall",
        "danger",
        `${ctx.name(r.recall?.requestedBy ?? r.requesterId)}님이 회수를 요청했습니다`,
        [
          `사유: ${r.recall?.reason ?? ""}`,
          "승인하면 요청이 작성 중으로 돌아가고 배정이 해제됩니다. 거절하면 현재 배정으로 검수를 이어갑니다.",
        ],
        "decideRecall",
      );
    } else {
      add("recall", "danger", "회수 요청 처리 중입니다", [
        `주담당 검수자 ${ctx.name(r.primaryReviewerId)}님이 승인 또는 거절합니다. 처리 전까지 요청자는 편집할 수 없습니다.`,
      ]);
    }
  }
  if (r.status === "IN_REVIEW" && !r.recallRequested && r.reviewerIds.includes(ctx.meId)) {
    if (r.primaryReviewerId === ctx.meId) {
      add("review", "info", "주담당 검수자입니다", [
        `${r.reviewerIds.length > 1 ? "공동 검수 결과와 " : ""}최종 대상 버전을 확인한 뒤 요청 단위 검수 완료를 처리합니다.`,
      ]);
    } else {
      add("review", "info", "공동 검수 중입니다", [
        `문안 편집, 검수 의견, 확인 요청은 함께 할 수 있습니다. 요청 단위 검수 완료와 회수 처리는 주담당 ${ctx.name(r.primaryReviewerId)}님만 합니다.`,
      ]);
    }
  }
  if (r.status === "APPROVAL_WAITING") {
    const names = r.eligibleApproverIds.map((id) => ctx.name(id)).join(", ") || "-";
    const lines = [
      `콘텐츠 버전, 검수자, 주담당이 고정되었습니다. 납기·긴급도는 승인자가 변경할 수 있습니다. 프로젝트 승인자 ${names} 중 한 명이 처리합니다.`,
    ];
    if (!r.allowedActions.includes("APPROVE") && ctx.meIsApprover) {
      lines.push("본인이 요청자이거나 배정 검수자인 요청은 승인할 수 없습니다.");
    }
    add("appr", "appr", "최종 승인을 기다리고 있습니다", lines);
  }
  if (FINAL_STATUSES.includes(r.status)) {
    add(
      "final",
      "done",
      `${REQUEST_STATUS_LABEL[r.status]}된 요청입니다`,
      [`${formatDateTime(r.bundle?.completedAt)}에 완료 묶음으로 고정되었습니다. 수정이 필요하면 후속 요청을 작성합니다.`],
      "showResult",
    );
  }
  return out;
}
