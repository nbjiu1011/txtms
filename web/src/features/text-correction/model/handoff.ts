import { create } from "zustand";
import type { CorrectionRun } from "./run";

/** A result handed to the content tab of `key` together with the card to show there (reference `gotoIssue`). */
export interface CorrectionHandoff {
  run: CorrectionRun;
  groupId: string;
}

interface HandoffState {
  items: Record<string, CorrectionHandoff>;
  put: (requestId: string, contentKey: string, handoff: CorrectionHandoff) => void;
  consume: (requestId: string, contentKey: string) => void;
}

export const handoffKey = (requestId: string, contentKey: string) => `${requestId}\u0000${contentKey}`;

/**
 * Tab-memory hand-over between work tabs: a card of another content clicked in a content tab opens
 * that content's tab, which adopts the result and highlights the expression.
 */
export const useCorrectionHandoff = create<HandoffState>((set) => ({
  items: {},
  put: (requestId, contentKey, handoff) =>
    set((s) => ({ items: { ...s.items, [handoffKey(requestId, contentKey)]: handoff } })),
  consume: (requestId, contentKey) =>
    set((s) => {
      const k = handoffKey(requestId, contentKey);
      if (!(k in s.items)) return s;
      const items = { ...s.items };
      delete items[k];
      return { items };
    }),
}));
