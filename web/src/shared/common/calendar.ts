import { kstDateKey } from "@/shared/lib";

/**
 * Calendar arithmetic (pure). Dates are `YYYY-MM-DD` strings (the API's date format) or year/month/day numbers —
 * never `Date` round trips: `new Date("2026-08-18").toISOString()` is UTC and shifts the day in KST.
 */
export interface Day {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export interface DayCell extends Day {
  /** Part of the month on screen (leading/trailing days of the neighbours fill the grid). */
  inMonth: boolean;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** `YYYY-MM-DD` → parts; null when the shape or the day is invalid (2026-02-31). */
export function parseDay(value: string | null | undefined): Day | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatDay(d: Day): string {
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`;
}

/** Today in KST — the service's calendar day, whatever the browser's time zone. */
export function today(now: number = Date.now()): Day {
  return parseDay(kstDateKey(now)) as Day;
}

export function weekday(d: Day): number {
  return new Date(d.year, d.month - 1, d.day).getDay();
}

/** `2026-10-14 (화)` — how a picked date reads in a field. */
export function dayLabel(value: string): string {
  const d = parseDay(value);
  return d ? `${value} (${WEEKDAYS[weekday(d)]})` : value;
}

/** Six weeks × seven days from Sunday: a fixed height, so the popover does not jump between months. */
export function monthGrid(year: number, month: number): DayCell[] {
  const lead = new Date(year, month - 1, 1).getDay();
  const cells: DayCell[] = [];
  for (let i = lead; i > 0; i--) cells.push({ ...addDays({ year, month, day: 1 }, -i), inMonth: false });
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push({ year, month, day: d, inMonth: true });
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    cells.push({ ...addDays(last, 1), inMonth: false });
  }
  return cells;
}

export function addDays(d: Day, days: number): Day {
  const t = new Date(d.year, d.month - 1, d.day + days);
  return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
}

/** Moves by months; the 31st of a month becomes the last day of a shorter month (not a day of the next one). */
export function addMonths(d: Day, months: number): Day {
  const raw = d.month - 1 + months;
  const year = d.year + Math.floor(raw / 12);
  const month = (((raw % 12) + 12) % 12) + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

export function compareDay(a: Day, b: Day): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function sameDay(a: Day, b: Day | null): boolean {
  return !!b && compareDay(a, b) === 0;
}

export function withinRange(d: Day, min: Day | null, max: Day | null): boolean {
  return !(min && compareDay(d, min) < 0) && !(max && compareDay(d, max) > 0);
}

/* ---------- ranges ---------- */

export interface DayRange {
  /** `YYYY-MM-DD` or "" (open). */
  from: string;
  to: string;
}

export interface RangePreset {
  key: string;
  label: string;
  range: (now?: number) => DayRange;
}

/** Quick picks of the range picker; the week runs Monday to Sunday. */
export const RANGE_PRESETS: RangePreset[] = [
  { key: "today", label: "오늘", range: (now) => single(today(now)) },
  {
    key: "week",
    label: "이번 주",
    range: (now) => {
      const t = today(now);
      const monday = addDays(t, -((weekday(t) + 6) % 7));
      return { from: formatDay(monday), to: formatDay(addDays(monday, 6)) };
    },
  },
  {
    key: "month",
    label: "이번 달",
    range: (now) => {
      const t = today(now);
      return {
        from: formatDay({ ...t, day: 1 }),
        to: formatDay({ ...t, day: daysInMonth(t.year, t.month) }),
      };
    },
  },
  { key: "last7", label: "최근 7일", range: (now) => lastDays(today(now), 7) },
  { key: "last30", label: "최근 30일", range: (now) => lastDays(today(now), 30) },
];

function single(d: Day): DayRange {
  return { from: formatDay(d), to: formatDay(d) };
}

function lastDays(t: Day, days: number): DayRange {
  return { from: formatDay(addDays(t, -(days - 1))), to: formatDay(t) };
}

/** The range from two picks in any order. */
export function orderedRange(a: Day, b: Day): DayRange {
  return compareDay(a, b) <= 0 ? { from: formatDay(a), to: formatDay(b) } : { from: formatDay(b), to: formatDay(a) };
}

/** `2026-10-01 ~ 2026-10-31`, an open side as `~ 2026-10-31` / `2026-10-01 ~`, or "" when both are empty. */
export function rangeLabel(range: DayRange): string {
  if (!range.from && !range.to) return "";
  if (range.from === range.to) return range.from;
  return `${range.from}${range.from ? " " : ""}~${range.to ? " " : ""}${range.to}`;
}
