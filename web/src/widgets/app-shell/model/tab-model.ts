import { isValidTabRef, tabIdentity, type TabRef } from "@/shared/config/routes";

/** Maximum number of open work tabs. */
export const MAX_TABS = 10;
export const TAB_LIMIT_MESSAGE = "업무 탭은 최대 10개입니다. 기존 탭을 닫아 주세요.";

export interface WorkTab extends TabRef {
  id: string;
  /** Unsaved changes in the tab (close asks for confirmation). */
  dirty: boolean;
  /** Title reported by the view (request/content titles). Not persisted. */
  title: string | null;
}

export interface TabsState {
  tabs: WorkTab[];
  activeId: string | null;
}

export type OpenStatus = "opened" | "activated" | "limit";

export interface OpenResult {
  state: TabsState;
  status: OpenStatus;
  /** Tab that is active after the call. */
  tabId: string | null;
}

export type IdFactory = () => string;

export function createTab(ref: TabRef, makeId: IdFactory): WorkTab {
  return { id: makeId(), route: ref.route, params: { ...ref.params }, dirty: false, title: null };
}

export function findTab(state: TabsState, ref: TabRef): WorkTab | undefined {
  const identity = tabIdentity(ref);
  return state.tabs.find((tab) => tabIdentity(tab) === identity);
}

/**
 * Opens or re-activates a tab. Requests are reused per request id, contents per request id +
 * content key, other routes per route. A new tab beyond the limit is refused (`limit`).
 */
export function openTab(state: TabsState, ref: TabRef, makeId: IdFactory): OpenResult {
  const existing = findTab(state, ref);
  if (existing) {
    return { state: { ...state, activeId: existing.id }, status: "activated", tabId: existing.id };
  }
  if (state.tabs.length >= MAX_TABS) {
    return { state, status: "limit", tabId: state.activeId };
  }
  const tab = createTab(ref, makeId);
  return { state: { tabs: [...state.tabs, tab], activeId: tab.id }, status: "opened", tabId: tab.id };
}

export function activateTab(state: TabsState, id: string): TabsState {
  return state.tabs.some((tab) => tab.id === id) ? { ...state, activeId: id } : state;
}

/**
 * Removes a tab. Closing the active tab activates its right neighbour, else the left one.
 * Closing the last tab leaves a fresh dashboard tab.
 */
export function closeTab(state: TabsState, id: string, makeId: IdFactory): TabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (tabs.length === 0) {
    const home = createTab({ route: "home", params: {} }, makeId);
    return { tabs: [home], activeId: home.id };
  }
  if (state.activeId !== id) return { tabs, activeId: state.activeId };
  const next = tabs[index] ?? tabs[index - 1] ?? tabs[0];
  return { tabs, activeId: next.id };
}

export function updateTab(state: TabsState, id: string, patch: Partial<Pick<WorkTab, "dirty" | "title">>): TabsState {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== id) return tab;
    const next = { ...tab, ...patch };
    if (next.dirty !== tab.dirty || next.title !== tab.title) changed = true;
    return next;
  });
  return changed ? { ...state, tabs } : state;
}

/** Persistable form: route + params only. */
export function serializeTabs(state: TabsState): TabRef[] {
  return state.tabs.map((tab) => ({ route: tab.route, params: { ...tab.params } }));
}

/** Restores persisted refs: valid entries only, duplicates dropped, at most 10. No tab is active yet. */
export function restoreTabs(stored: unknown, makeId: IdFactory): TabsState {
  const refs = Array.isArray(stored) ? stored.filter(isValidTabRef) : [];
  const seen = new Set<string>();
  const tabs: WorkTab[] = [];
  for (const ref of refs) {
    const identity = tabIdentity(ref);
    if (seen.has(identity)) continue;
    seen.add(identity);
    tabs.push(createTab(ref, makeId));
    if (tabs.length >= MAX_TABS) break;
  }
  return { tabs, activeId: null };
}
