import { describe, expect, it } from "vitest";
import { buildHistoryTimeline, historyTargetLabel, type HistoryRow } from "./history";
import type { HistoryEntry } from "./types";

const entry = (id: number, at: string, round: number, contentKey: string | null = null): HistoryEntry => ({
  id,
  at,
  actorId: 1,
  action: `a${id}`,
  detail: null,
  contentKey,
  contentTitle: contentKey ? `title ${contentKey}` : null,
  round,
});

const shape = (rows: HistoryRow[]) => rows.map((r) => (r.kind === "round" ? `R${r.round}` : r.entry.id));

const entries = [
  entry(5, "2026-10-05T10:00:00Z", 2, "C1"),
  entry(1, "2026-10-01T00:00:00Z", 1),
  entry(3, "2026-10-03T00:00:00Z", 1, "C2"),
  entry(4, "2026-10-04T00:00:00Z", 2),
  entry(2, "2026-10-02T00:00:00Z", 1),
];

describe("buildHistoryTimeline", () => {
  it("sorts oldest first and inserts a round separator before each round", () => {
    expect(shape(buildHistoryTimeline(entries, "all"))).toEqual(["R1", 1, 2, 3, "R2", 4, 5]);
  });

  it("filters the request log (no content key)", () => {
    expect(shape(buildHistoryTimeline(entries, "request"))).toEqual(["R1", 1, 2, "R2", 4]);
  });

  it("filters the content log and marks content entries", () => {
    const rows = buildHistoryTimeline(entries, "content");
    expect(shape(rows)).toEqual(["R1", 3, "R2", 5]);
    expect(rows.every((r) => r.kind === "round" || r.content)).toBe(true);
  });

  it("adds a separator again when the round changes back", () => {
    const rows = buildHistoryTimeline(
      [entry(1, "2026-10-01T00:00:00Z", 1), entry(2, "2026-10-02T00:00:00Z", 2), entry(3, "2026-10-03T00:00:00Z", 1)],
      "all",
    );
    expect(shape(rows)).toEqual(["R1", 1, "R2", 2, "R1", 3]);
  });

  it("keeps the API order for equal times", () => {
    const rows = buildHistoryTimeline([entry(9, "2026-10-01T00:00:00Z", 1), entry(8, "2026-10-01T00:00:00Z", 1)], "all");
    expect(shape(rows)).toEqual(["R1", 9, 8]);
  });

  it("is empty without entries", () => {
    expect(buildHistoryTimeline([], "all")).toEqual([]);
  });
});

describe("historyTargetLabel", () => {
  it("labels request-wide and content entries", () => {
    expect(historyTargetLabel({ contentKey: null, contentTitle: null })).toBe("요청 전체");
    expect(historyTargetLabel({ contentKey: "C2", contentTitle: "적립 예정 안내" })).toBe("C2  적립 예정 안내");
  });
});
