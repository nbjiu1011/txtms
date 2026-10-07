import type { Content, ContentLockState } from "./types";

/**
 * The light lock list (`GET /api/requests/{id}/locks`) shows something the cached detail does not: a lock
 * taken, released or moved to someone else, a newer content version, or a content added or removed.
 */
export function locksDiffer(contents: readonly Pick<Content, "key" | "version" | "lock">[], locks: readonly ContentLockState[]): boolean {
  if (contents.length !== locks.length) return true;
  const byKey = new Map(locks.map((l) => [l.contentKey, l]));
  return contents.some((c) => {
    const state = byKey.get(c.key);
    return !state || state.version !== c.version || (c.lock?.userId ?? null) !== state.userId;
  });
}
