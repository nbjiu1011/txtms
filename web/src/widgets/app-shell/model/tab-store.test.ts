import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/shared/ui";
import { MAX_TABS, TAB_LIMIT_MESSAGE } from "./tab-model";
import { closeRequestTabs, ensureTabRoom, tabsStorageKey, useTabStore } from "./tab-store";

vi.mock("@/shared/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ui")>()),
  toast: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  useTabStore.setState({ tabs: [], activeId: null, userId: null });
});

describe("tab store", () => {
  it("persists only route + params per user and restores them", () => {
    const store = useTabStore.getState();
    store.hydrate(7);
    store.open({ route: "home", params: {} });
    expect(useTabStore.getState().open({ route: "request", params: { id: "R1" } })).toBe("opened");
    const requestTab = useTabStore.getState().tabs[1];
    useTabStore.getState().setDirty(requestTab.id, true);
    useTabStore.getState().setTitle(requestTab.id, "10월 혜택");

    expect(JSON.parse(localStorage.getItem(tabsStorageKey(7)) ?? "null")).toEqual([
      { route: "home", params: {} },
      { route: "request", params: { id: "R1" } },
    ]);

    useTabStore.setState({ tabs: [], activeId: null, userId: null });
    useTabStore.getState().hydrate(7);
    const restored = useTabStore.getState().tabs;
    expect(restored.map((t) => [t.route, t.dirty, t.title])).toEqual([
      ["home", false, null],
      ["request", false, null],
    ]);
  });

  it("keeps tab lists separate per user", () => {
    useTabStore.getState().hydrate(1);
    useTabStore.getState().open({ route: "requests", params: {} });
    useTabStore.setState({ tabs: [], activeId: null, userId: null });
    useTabStore.getState().hydrate(2);
    expect(useTabStore.getState().tabs).toEqual([]);
  });
});

describe("closeRequestTabs", () => {
  it("closes the request tab and its content tabs, nothing else", () => {
    const store = useTabStore.getState();
    store.hydrate(7);
    store.open({ route: "requests", params: {} });
    store.open({ route: "request", params: { id: "R1" } });
    store.open({ route: "content", params: { id: "R1", key: "C1" } });
    store.open({ route: "request", params: { id: "R2" } });
    closeRequestTabs("R1");
    expect(useTabStore.getState().tabs.map((t) => [t.route, t.params.id ?? null])).toEqual([
      ["requests", null],
      ["request", "R2"],
    ]);
  });
});

describe("ensureTabRoom", () => {
  it("allows a new tab below the limit and refuses with the limit message at it", () => {
    const store = useTabStore.getState();
    store.hydrate(7);
    for (let i = 0; i < MAX_TABS - 1; i++) store.open({ route: "request", params: { id: `R${i}` } });
    expect(ensureTabRoom()).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    useTabStore.getState().open({ route: "request", params: { id: "R-last" } });
    expect(ensureTabRoom()).toBe(false);
    expect(toast).toHaveBeenCalledWith(TAB_LIMIT_MESSAGE);
  });
});
