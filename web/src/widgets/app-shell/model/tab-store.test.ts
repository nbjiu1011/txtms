import { beforeEach, describe, expect, it } from "vitest";
import { tabsStorageKey, useTabStore } from "./tab-store";

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
