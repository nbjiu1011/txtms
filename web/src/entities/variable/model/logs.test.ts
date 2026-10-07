import { describe, expect, it } from "vitest";
import type { ProjectVariableLog } from "./types";
import { logsByVariable } from "./logs";

const log = (variableId: number, at: string, action: string): ProjectVariableLog => ({
  variableId,
  at,
  action,
  actorId: 1,
  actorName: "강민호",
  before: null,
  after: null,
});

describe("logsByVariable", () => {
  it("groups the newest-first project log per variable, oldest first inside a group", () => {
    const groups = logsByVariable([
      log(2, "2026-10-03T00:00:00Z", "삭제 (이력 보존)"),
      log(1, "2026-10-02T00:00:00Z", "변경"),
      log(2, "2026-10-01T12:00:00Z", "등록"),
      log(1, "2026-10-01T00:00:00Z", "등록"),
    ]);
    expect(groups.get(1)?.map((l) => l.action)).toEqual(["등록", "변경"]);
    expect(groups.get(2)?.map((l) => l.action)).toEqual(["등록", "삭제 (이력 보존)"]);
    expect(groups.get(3)).toBeUndefined();
  });

  it("returns an empty map for an empty log", () => {
    expect(logsByVariable([]).size).toBe(0);
  });
});
