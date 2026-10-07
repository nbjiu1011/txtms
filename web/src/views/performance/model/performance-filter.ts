import type { PerformanceParams } from "@/entities/dashboard";

/** Period presets of the reference filter (`m` 이번 달, `30` 최근 30일, `90` 최근 90일). */
export type PerformancePeriod = "m" | "30" | "90";

export const PERIOD_OPTIONS: { value: PerformancePeriod; label: string }[] = [
  { value: "m", label: "이번 달" },
  { value: "30", label: "최근 30일" },
  { value: "90", label: "최근 90일" },
];

/** `all` = 권한 있는 전체 (the server picks the permitted projects). */
export type PerformanceProject = number | "all";

export interface PerformanceFilter {
  period: PerformancePeriod;
  /** 접수일 직접 지정 (KST `YYYY-MM-DD`, empty = preset / today). */
  from: string;
  to: string;
  project: PerformanceProject;
  /** Reviewer filter of the personal rows (null = 전체). */
  userId: number | null;
}

/** `YYYY-MM-DD` shifted by whole days (calendar arithmetic in UTC, no time zone effects). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Start date of a preset counted from today (KST): month start, or today − (N − 1) days. */
export function presetFrom(period: PerformancePeriod, today: string): string {
  if (period === "m") return `${today.slice(0, 7)}-01`;
  return shiftDate(today, -(Number(period) - 1));
}

/**
 * Filter → `GET /api/performance` query. A typed start date wins over the preset (reference: the
 * preset only fills a missing start); a missing end is "today" on the server. `all` omits the
 * project, a null user omits the user.
 */
export function toPerformanceParams(filter: PerformanceFilter, customerId: number, today: string): PerformanceParams {
  const params: PerformanceParams = { customerId, from: filter.from || presetFrom(filter.period, today) };
  if (filter.to) params.to = filter.to;
  if (filter.project !== "all") params.projectId = filter.project;
  if (filter.userId !== null) params.userId = filter.userId;
  return params;
}

/** Completion rate text: one decimal at most, `–` when nothing was received. */
export function formatRate(rate: number | null): string {
  if (rate === null) return "–";
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

/** Default project of the filter: the current project when it is permitted, else the first, else all. */
export function defaultProject(permitted: number[], current: number | null): PerformanceProject {
  if (current !== null && permitted.includes(current)) return current;
  return permitted[0] ?? "all";
}
