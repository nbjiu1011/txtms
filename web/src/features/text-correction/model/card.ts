import { actionableOptions, blockingGroup, type CorrectionRun, type GroupState } from "./run";

/**
 * What a result card shows (화면설계 PNG): ② one recommendation as a button (1:1), 2-2 a select of
 * recommendations (1:N), ⑤ no recommendation area for description-only rules; ③ restore is always
 * shown but only enabled once applied.
 */
export type CardMode = "single" | "multi" | "describe";

export interface CardView {
  mode: CardMode;
  /** 교정 유형 라벨 (of the applied option, else the first one). */
  label: string;
  /** 교정 이유 (follows the label). */
  description: string;
  /** Replacement options as `[option index, text]`. */
  choices: [number, string][];
  /** Applied option index (null: original in place). */
  applied: number | null;
  /** Apply buttons / select usable. */
  canApply: boolean;
  /** 복원 usable (applied and editable). */
  canRestore: boolean;
  /** Why applying is not possible right now (shown as a hint), null when it is or nothing to apply. */
  blockedReason: string | null;
}

export interface CardContext {
  /** The viewer may edit this content now (policy, no other editor's lock, not excluded). */
  editable: boolean;
  /** The result no longer matches the text (stale). */
  stale: boolean;
}

export function cardView(run: CorrectionRun, group: GroupState, ctx: CardContext): CardView {
  const choices = actionableOptions(group).map((i): [number, string] => [i, group.options[i].recommended ?? ""]);
  const shown = group.options[group.applied ?? choices[0]?.[0] ?? 0] ?? group.options[0];
  const mode: CardMode = choices.length === 0 ? "describe" : choices.length === 1 ? "single" : "multi";
  const blocker = blockingGroup(run, group);
  const usable = ctx.editable && !ctx.stale;
  let blockedReason: string | null = null;
  if (mode !== "describe" && group.applied === null && blocker) {
    blockedReason = `겹치는 교정(${blocker.matchedText})이 적용되어 있어 선택할 수 없습니다`;
  }
  return {
    mode,
    label: shown?.descriptionLabel ?? "",
    description: shown?.description ?? "",
    choices,
    applied: group.applied,
    canApply: usable && mode !== "describe" && !blocker,
    canRestore: usable && group.applied !== null,
    blockedReason,
  };
}
