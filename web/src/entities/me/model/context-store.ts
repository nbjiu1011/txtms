import { create } from "zustand";
import { readJson, writeJson } from "@/shared/lib";
import type { Me } from "./types";

/**
 * Selected customer/project (top bar). Remembered per user in localStorage as a UI
 * convenience only — every API call is authorised by the server.
 */
interface StoredContext {
  customerId: number | null;
  projectId: number | null;
}

interface WorkContextState extends StoredContext {
  userId: number | null;
  /** Restores the remembered context for `me` (or the defaults). */
  init: (me: Me) => void;
  setCustomer: (customerId: number, projectId: number | null) => void;
  setProject: (projectId: number | null) => void;
  reset: () => void;
}

const storageKey = (userId: number) => `txtms:context:${userId}`;

/** First project of `customerId` where the user is a member. */
export function defaultProjectId(me: Me, customerId: number | null): number | null {
  if (customerId === null) return null;
  return me.memberships.find((m) => m.customerId === customerId)?.projectId ?? null;
}

export const useWorkContextStore = create<WorkContextState>((set, get) => {
  const persist = () => {
    const { userId, customerId, projectId } = get();
    if (userId !== null) writeJson(storageKey(userId), { customerId, projectId } satisfies StoredContext);
  };
  return {
    userId: null,
    customerId: null,
    projectId: null,
    init: (me) => {
      if (get().userId === me.id) return;
      const saved = readJson<StoredContext>(storageKey(me.id));
      const customerId =
        typeof saved?.customerId === "number" ? saved.customerId : (me.customerId ?? me.adminCustomerIds[0] ?? null);
      const projectId =
        typeof saved?.projectId === "number" && saved.customerId === customerId
          ? saved.projectId
          : defaultProjectId(me, customerId);
      set({ userId: me.id, customerId, projectId });
    },
    setCustomer: (customerId, projectId) => {
      set({ customerId, projectId });
      persist();
    },
    setProject: (projectId) => {
      set({ projectId });
      persist();
    },
    reset: () => set({ userId: null, customerId: null, projectId: null }),
  };
});
