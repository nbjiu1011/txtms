import { create } from "zustand";

interface ViewIntentStore {
  /** Target view key (a route key) → one-shot payload, e.g. the notice to expand. */
  intents: Record<string, string>;
  request: (view: string, payload: string) => void;
  /** Removes and returns the pending payload of a view. */
  consume: (view: string) => string | null;
}

/**
 * One-shot hand-off between work tabs ("open the notices tab with notice 3 expanded", "open the
 * users tab on its audit sub tab"). UI state only — never persisted. The receiving view reads
 * `intents[view]` and consumes it once it is visible.
 */
export const useViewIntent = create<ViewIntentStore>((set, get) => ({
  intents: {},
  request: (view, payload) => set((s) => ({ intents: { ...s.intents, [view]: payload } })),
  consume: (view) => {
    const payload = get().intents[view] ?? null;
    if (payload !== null) {
      set((s) => {
        const next = { ...s.intents };
        delete next[view];
        return { intents: next };
      });
    }
    return payload;
  },
}));
