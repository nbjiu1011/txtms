import type { HistoryEntry } from "./types";

/** History filter: all, request-level log (`contentKey` null), or content log. */
export type HistoryFilter = "all" | "request" | "content";

export type HistoryRow =
  | { kind: "round"; round: number; key: string }
  | { kind: "entry"; entry: HistoryEntry; content: boolean; key: string };

/**
 * Merged timeline (oldest first) with a round separator before the first entry and whenever the
 * round changes (reference `vHist`).
 */
export function buildHistoryTimeline(entries: readonly HistoryEntry[], filter: HistoryFilter): HistoryRow[] {
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => Date.parse(a.entry.at) - Date.parse(b.entry.at) || a.index - b.index)
    .map((x) => x.entry)
    .filter((e) => filter === "all" || (filter === "request" ? e.contentKey === null : e.contentKey !== null));
  const rows: HistoryRow[] = [];
  let lastRound: number | null = null;
  for (const entry of sorted) {
    if (entry.round !== lastRound) {
      rows.push({ kind: "round", round: entry.round, key: `round-${entry.round}-${entry.id}` });
      lastRound = entry.round;
    }
    rows.push({ kind: "entry", entry, content: entry.contentKey !== null, key: `entry-${entry.id}` });
  }
  return rows;
}

/** Target label of an entry: '요청 전체' or `C1  제목`. */
export function historyTargetLabel(entry: Pick<HistoryEntry, "contentKey" | "contentTitle">): string {
  return entry.contentKey === null ? "요청 전체" : `${entry.contentKey}  ${entry.contentTitle ?? ""}`.trimEnd();
}
