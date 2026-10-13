import { describe, expect, it } from "vitest";
import type { Project } from "@/entities/project";
import type { UserSummary } from "@/entities/user";
import {
  defaultProject,
  formatRate,
  presetFrom,
  shiftDate,
  toPerformanceParams,
  type PerformanceFilter,
} from "./performance-filter";
import { permittedProjects, reviewerOptions } from "./reviewer-options";

const base: PerformanceFilter = { period: "30", from: "", to: "", project: 1, userId: null };

describe("performance filter → GET /api/performance query", () => {
  it("presets count back from today (KST date), month = first of the month", () => {
    expect(presetFrom("30", "2026-10-07")).toBe("2026-09-08");
    expect(presetFrom("90", "2026-10-07")).toBe("2026-07-10");
    expect(presetFrom("m", "2026-10-07")).toBe("2026-10-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("maps period, project and user; the end date is omitted (server: today, inclusive)", () => {
    expect(toPerformanceParams(base, 1, "2026-10-07")).toEqual({ customerId: 1, from: "2026-09-08", projectId: 1 });
    expect(toPerformanceParams({ ...base, period: "m", project: "all", userId: 2 }, 1, "2026-10-07")).toEqual({
      customerId: 1,
      from: "2026-10-01",
      userId: 2,
    });
  });

  it("typed dates win over the preset; only the start falls back to the preset", () => {
    expect(toPerformanceParams({ ...base, from: "2026-09-01", to: "2026-09-30" }, 1, "2026-10-07")).toEqual({
      customerId: 1,
      from: "2026-09-01",
      to: "2026-09-30",
      projectId: 1,
    });
    expect(toPerformanceParams({ ...base, to: "2026-09-30" }, 1, "2026-10-07").from).toBe("2026-09-08");
  });

  it("formats the completion rate: `–` for null, one decimal at most", () => {
    expect(formatRate(null)).toBe("–");
    expect(formatRate(75)).toBe("75");
    expect(formatRate(34.6)).toBe("34.6");
    expect(formatRate(0)).toBe("0");
  });

  it("defaults to the current project when permitted, else the first, else all", () => {
    expect(defaultProject([1, 2], 2)).toBe(2);
    expect(defaultProject([1, 2], 5)).toBe(1);
    expect(defaultProject([], 5)).toBe("all");
  });
});

describe("performance project and reviewer options", () => {
  const project = (id: number, members: Project["members"]): Project => ({
    id,
    customerId: 1,
    name: `P${id}`,
    active: true,
    leadUserId: 3,
    templates: [],
    members,
    variablesRevision: 0,
  });
  const p1 = project(1, [
    { userId: 6, roles: ["REVIEWER"] },
    { userId: 2, roles: ["REVIEWER"] },
    { userId: 1, roles: ["REQUESTER"] },
  ]);
  const p2 = project(2, [
    { userId: 3, roles: ["REVIEWER"] },
    { userId: 9, roles: ["REVIEWER"] },
  ]);
  const user = (id: number, active = true): UserSummary => ({
    id,
    name: `U${id}`,
    dept: "",
    email: "",
    active,
    avatarColor: "#000",
  });
  const users = new Map<number, UserSummary>([
    [1, user(1)],
    [2, user(2)],
    [3, user(3)],
    [6, user(6)],
    [9, user(9, false)],
  ]);
  const directory = { get: (id: number | null | undefined) => (id == null ? undefined : users.get(id)) };

  it("admins see every project, leads only the projects they lead", () => {
    expect(permittedProjects([p1, p2], true, []).map((p) => p.id)).toEqual([1, 2]);
    expect(permittedProjects([p1, p2], false, [2]).map((p) => p.id)).toEqual([2]);
  });

  it("lists active reviewers of the target projects in user id order", () => {
    expect(reviewerOptions([p1, p2], 1, directory).map((u) => u.id)).toEqual([2, 6]);
    expect(reviewerOptions([p1, p2], "all", directory).map((u) => u.id)).toEqual([2, 3, 6]);
  });
});
