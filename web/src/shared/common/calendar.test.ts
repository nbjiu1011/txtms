import { describe, expect, it } from "vitest";
import {
  RANGE_PRESETS,
  addMonths,
  dayLabel,
  monthGrid,
  orderedRange,
  parseDay,
  rangeLabel,
  today,
  withinRange,
} from "./calendar";

// 2026-10-14 (Wednesday) 09:00 KST = 00:00 UTC
const NOW = Date.UTC(2026, 9, 14, 0, 0);
const preset = (key: string) => RANGE_PRESETS.find((p) => p.key === key)!.range(NOW);

describe("calendar", () => {
  it("parses only real days and labels them with the weekday", () => {
    expect(parseDay("2026-02-31")).toBeNull();
    expect(parseDay("2026-10-14")).toEqual({ year: 2026, month: 10, day: 14 });
    expect(dayLabel("2026-10-14")).toBe("2026-10-14 (수)");
  });

  it("takes today in KST, not in UTC", () => {
    // 2026-10-13 23:30 UTC is already 10-14 in Seoul
    expect(today(Date.UTC(2026, 9, 13, 23, 30))).toEqual({ year: 2026, month: 10, day: 14 });
  });

  it("draws six weeks from Sunday and keeps month ends when moving months", () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toMatchObject({ year: 2026, month: 9, day: 27, inMonth: false });
    expect(grid.find((c) => c.inMonth)).toMatchObject({ day: 1 });
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({ year: 2025, month: 12, day: 15 });
  });

  it("checks min and max", () => {
    const min = parseDay("2026-10-10");
    const max = parseDay("2026-10-20");
    expect(withinRange({ year: 2026, month: 10, day: 9 }, min, max)).toBe(false);
    expect(withinRange({ year: 2026, month: 10, day: 20 }, min, max)).toBe(true);
  });

  it("offers quick periods (week from Monday)", () => {
    expect(preset("today")).toEqual({ from: "2026-10-14", to: "2026-10-14" });
    expect(preset("week")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(preset("month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(preset("last7")).toEqual({ from: "2026-10-08", to: "2026-10-14" });
    expect(preset("last30")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });

  it("orders two picks and labels ranges", () => {
    expect(orderedRange({ year: 2026, month: 10, day: 20 }, { year: 2026, month: 10, day: 3 })).toEqual({
      from: "2026-10-03",
      to: "2026-10-20",
    });
    expect(rangeLabel({ from: "", to: "" })).toBe("");
    expect(rangeLabel({ from: "2026-10-01", to: "2026-10-31" })).toBe("2026-10-01 ~ 2026-10-31");
    expect(rangeLabel({ from: "2026-10-01", to: "2026-10-01" })).toBe("2026-10-01");
    expect(rangeLabel({ from: "", to: "2026-10-31" })).toBe("~ 2026-10-31");
  });
});
