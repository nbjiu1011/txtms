import { create } from "zustand";
import type { RequestAction } from "./types";

interface ActionIntentStore {
  /** Request id → action to start once its tab shows the request (e.g. 배정 from the 검수 screen). */
  intents: Record<string, RequestAction>;
  request: (requestId: string, action: RequestAction) => void;
  /** Removes and returns the pending action of a request. */
  consume: (requestId: string) => RequestAction | null;
}

/** One-shot "open this request and start an action" hand-off between screens (UI state only). */
export const useRequestActionIntent = create<ActionIntentStore>((set, get) => ({
  intents: {},
  request: (requestId, action) => set((s) => ({ intents: { ...s.intents, [requestId]: action } })),
  consume: (requestId) => {
    const action = get().intents[requestId] ?? null;
    if (action) {
      set((s) => {
        const next = { ...s.intents };
        delete next[requestId];
        return { intents: next };
      });
    }
    return action;
  },
}));
