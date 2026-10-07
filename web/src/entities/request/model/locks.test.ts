import { describe, expect, it } from "vitest";
import type { ContentLockState } from "./types";
import { locksDiffer } from "./locks";

const lock = (userId: number) => ({ userId, lockedAt: "", expiresAt: "" });
const contents = [
  { key: "C1", version: 2, lock: null },
  { key: "C2", version: 1, lock: lock(6) },
];
const state = (contentKey: string, version: number, userId: number | null): ContentLockState => ({
  contentKey,
  version,
  userId,
  lockedAt: null,
  expiresAt: null,
});

describe("locksDiffer", () => {
  it("is false when every content has the same version and lock holder", () => {
    expect(locksDiffer(contents, [state("C1", 2, null), state("C2", 1, 6)])).toBe(false);
  });

  it("notices a lock taken, released or moved", () => {
    expect(locksDiffer(contents, [state("C1", 2, 3), state("C2", 1, 6)])).toBe(true);
    expect(locksDiffer(contents, [state("C1", 2, null), state("C2", 1, null)])).toBe(true);
    expect(locksDiffer(contents, [state("C1", 2, null), state("C2", 1, 3)])).toBe(true);
  });

  it("notices a newer version and added or removed contents", () => {
    expect(locksDiffer(contents, [state("C1", 3, null), state("C2", 1, 6)])).toBe(true);
    expect(locksDiffer(contents, [state("C1", 2, null)])).toBe(true);
    expect(locksDiffer(contents, [state("C1", 2, null), state("C3", 1, 6)])).toBe(true);
  });
});
