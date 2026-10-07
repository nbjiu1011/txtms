import { create } from "zustand";
import type { Me } from "./types";

export type SessionStatus = "unknown" | "authenticated" | "anonymous";

interface SessionState {
  /** unknown until the start-up refresh resolves. */
  status: SessionStatus;
  me: Me | null;
  setMe: (me: Me) => void;
  setAnonymous: () => void;
}

/** Current user (in memory). The access token itself lives in `shared/api`. */
export const useSessionStore = create<SessionState>((set) => ({
  status: "unknown",
  me: null,
  setMe: (me) => set({ me, status: "authenticated" }),
  setAnonymous: () => set({ me: null, status: "anonymous" }),
}));
