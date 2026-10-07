import type { CorrectionGroup, CorrectionOption, CorrectionResult } from "@/entities/correction";

/**
 * One checked expression as the panel tracks it. `start`/`end` follow the text: they move when an
 * earlier correction in the same field changes its length, and `end` covers the applied text while a
 * correction is applied (contract §6, actions §6.6).
 */
export interface GroupState {
  id: string;
  field: string;
  start: number;
  end: number;
  /** Original expression (restore always returns to it). */
  matchedText: string;
  options: CorrectionOption[];
  /** Index of the applied option, null when the original text is in place. */
  applied: number | null;
}

/** The result of one content check plus the local apply/restore state. */
export interface CorrectionRun {
  contentKey: string;
  checkedAt: string;
  datasetLabel: string;
  variablesRevision: number;
  /** Server excluded the content (free-form with attachments). */
  excluded: boolean;
  /** Normalized payload the positions refer to (freshness; updated by every apply/restore). */
  snapshot: string;
  groups: GroupState[];
  /** Partially overlapping groups of the same field (both shown; one applied disables the others). */
  conflicts: Readonly<Record<string, readonly string[]>>;
}

function overlaps(a: CorrectionGroup, b: CorrectionGroup): boolean {
  return a.field === b.field && a.start < b.end && b.start < a.end;
}

/** Starts tracking a server result checked from the payload whose snapshot is `snapshot`. */
export function createRun(result: CorrectionResult, snapshot: string): CorrectionRun {
  const conflicts: Record<string, string[]> = {};
  for (const g of result.groups) {
    const others = result.groups.filter((o) => o.id !== g.id && overlaps(g, o)).map((o) => o.id);
    if (others.length) conflicts[g.id] = others;
  }
  return {
    contentKey: result.contentKey,
    checkedAt: result.checkedAt,
    datasetLabel: result.datasetLabel,
    variablesRevision: result.variablesRevision,
    excluded: result.excluded,
    snapshot,
    groups: result.groups.map((g) => ({
      id: g.id,
      field: g.field,
      start: g.start,
      end: g.end,
      matchedText: g.matchedText,
      options: g.options,
      applied: null,
    })),
    conflicts,
  };
}

/** Indexes of options that carry a replacement (description-only rules have none). */
export function actionableOptions(group: Pick<GroupState, "options">): number[] {
  return group.options.flatMap((o, i) => (o.recommended === null ? [] : [i]));
}

/** Text currently in place for the group. */
export function currentText(group: GroupState): string {
  if (group.applied === null) return group.matchedText;
  return group.options[group.applied]?.recommended ?? group.matchedText;
}

/** An applied group that partially overlaps `group` (then `group` cannot be applied). */
export function blockingGroup(run: CorrectionRun, group: GroupState): GroupState | null {
  for (const id of run.conflicts[group.id] ?? []) {
    const other = run.groups.find((g) => g.id === id);
    if (other && other.applied !== null) return other;
  }
  return null;
}

export const CHANGED_MESSAGE = "해당 표현이 변경되었습니다. 다시 검사하세요";
export const BLOCKED_MESSAGE = "겹치는 다른 교정이 적용되어 있습니다. 먼저 복원하세요";

/** A planned replacement inside one field. */
export interface Replacement {
  groupId: string;
  field: string;
  start: number;
  before: string;
  after: string;
  /** Option applied after the replacement (null = restored). */
  applied: number | null;
}

export type PlanResult = { ok: true; replacement: Replacement } | { ok: false; message: string };

/**
 * Apply (or swap to) option `optionIndex`: `before` is what is in place now — the original, or the
 * applied option when swapping directly between options (no restore needed).
 */
export function planApply(run: CorrectionRun, groupId: string, optionIndex: number, fieldText: string): PlanResult {
  const group = run.groups.find((g) => g.id === groupId);
  const after = group?.options[optionIndex]?.recommended;
  if (!group || after === null || after === undefined || group.applied === optionIndex) {
    return { ok: false, message: "적용할 권장 표현이 없습니다" };
  }
  if (blockingGroup(run, group)) return { ok: false, message: BLOCKED_MESSAGE };
  return plan(group, after, optionIndex, fieldText);
}

/** Restore always returns the original expression. */
export function planRestore(run: CorrectionRun, groupId: string, fieldText: string): PlanResult {
  const group = run.groups.find((g) => g.id === groupId);
  if (!group || group.applied === null) return { ok: false, message: "복원할 교정이 없습니다" };
  return plan(group, group.matchedText, null, fieldText);
}

function plan(group: GroupState, after: string, applied: number | null, fieldText: string): PlanResult {
  const before = currentText(group);
  if (fieldText.slice(group.start, group.end) !== before || group.end - group.start !== before.length) {
    return { ok: false, message: CHANGED_MESSAGE };
  }
  return { ok: true, replacement: { groupId: group.id, field: group.field, start: group.start, before, after, applied } };
}

/** The field text after the replacement. */
export function replaceText(fieldText: string, r: Replacement): string {
  return fieldText.slice(0, r.start) + r.after + fieldText.slice(r.start + r.before.length);
}

/**
 * Records a replacement: the group covers the new text, later groups of the same field shift by the
 * length difference (overlapping groups never move — they stay disabled while this one is applied,
 * and are back in place once it is restored), and the snapshot follows the new payload.
 */
export function commitReplacement(run: CorrectionRun, r: Replacement, snapshot: string): CorrectionRun {
  const delta = r.after.length - r.before.length;
  const oldEnd = r.start + r.before.length;
  const pinned = new Set(run.conflicts[r.groupId] ?? []);
  return {
    ...run,
    snapshot,
    groups: run.groups.map((g) => {
      if (g.id === r.groupId) return { ...g, end: r.start + r.after.length, applied: r.applied };
      if (g.field !== r.field || pinned.has(g.id) || g.start < oldEnd) return g;
      return { ...g, start: g.start + delta, end: g.end + delta };
    }),
  };
}

/** Counts of the bottom bar. */
export function countRuns(runs: readonly CorrectionRun[]): { results: number; applied: number } {
  let results = 0;
  let applied = 0;
  for (const run of runs) {
    results += run.groups.length;
    applied += run.groups.filter((g) => g.applied !== null).length;
  }
  return { results, applied };
}
