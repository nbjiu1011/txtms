import { create } from "zustand";
import { readJson, writeJson } from "@/shared/lib";
import type { TabRef } from "@/shared/config/routes";
import {
  activateTab,
  closeTab,
  openTab,
  restoreTabs,
  serializeTabs,
  updateTab,
  type OpenStatus,
  type TabsState,
  type WorkTab,
} from "./tab-model";

let seq = 0;
const makeId = () => `t${++seq}`;

export const tabsStorageKey = (userId: number) => `txtms:tabs:${userId}`;

interface TabStore extends TabsState {
  userId: number | null;
  /** Restores the user's saved tab list (route + params only). */
  hydrate: (userId: number) => void;
  open: (ref: TabRef) => OpenStatus;
  activate: (id: string) => void;
  close: (id: string) => void;
  setDirty: (id: string, dirty: boolean) => void;
  setTitle: (id: string, title: string | null) => void;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeId: null,
  userId: null,
  hydrate: (userId) => {
    if (get().userId === userId) return;
    const restored = restoreTabs(readJson<unknown>(tabsStorageKey(userId)), makeId);
    set({ ...restored, userId });
  },
  open: (ref) => {
    const result = openTab(get(), ref, makeId);
    if (result.status !== "limit") set(result.state);
    return result.status;
  },
  activate: (id) => set(activateTab(get(), id)),
  close: (id) => set(closeTab(get(), id, makeId)),
  setDirty: (id, dirty) => set(updateTab(get(), id, { dirty })),
  setTitle: (id, title) => set(updateTab(get(), id, { title })),
}));

/** Persist only the tab list (never inputs, filters or tokens). */
useTabStore.subscribe((state, prev) => {
  if (state.userId === null) return;
  if (state.tabs === prev.tabs && state.userId === prev.userId) return;
  writeJson(tabsStorageKey(state.userId), serializeTabs(state));
});

export function getActiveTab(): WorkTab | undefined {
  const { tabs, activeId } = useTabStore.getState();
  return tabs.find((tab) => tab.id === activeId);
}

/** The work tab is still open (background work of a closed tab stops). */
export function isTabOpen(tabId: string): boolean {
  return useTabStore.getState().tabs.some((tab) => tab.id === tabId);
}

/** Some open tab holds unsaved changes (page leave warning). */
export function hasDirtyTab(): boolean {
  return useTabStore.getState().tabs.some((tab) => tab.dirty);
}
