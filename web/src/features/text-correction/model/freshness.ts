import { normalizePayload, type ContentPayload, type ContentType } from "@/entities/request";
import type { CorrectionRun } from "./run";

/** Normalized payload string a result refers to (contract §6 freshness: keys in a fixed order). */
export function payloadSnapshot(type: ContentType, payload: ContentPayload): string {
  return JSON.stringify(normalizePayload(type, payload));
}

/**
 * 최신 내용과 불일치: the text/links changed since the check (or the last apply/restore), or the
 * project variables changed. A project copy older than the check is not a change (revisions only grow).
 */
export function isStale(
  run: Pick<CorrectionRun, "snapshot" | "variablesRevision">,
  currentSnapshot: string,
  variablesRevision: number | null,
): boolean {
  if (currentSnapshot !== run.snapshot) return true;
  return variablesRevision !== null && variablesRevision > run.variablesRevision;
}
