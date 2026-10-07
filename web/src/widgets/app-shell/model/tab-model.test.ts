import { describe, expect, it } from "vitest";
import type { TabRef } from "@/shared/config/routes";
import {
  MAX_TABS,
  activateTab,
  closeTab,
  openTab,
  restoreTabs,
  serializeTabs,
  updateTab,
  type TabsState,
} from "./tab-model";

function ids() {
  let n = 0;
  return () => `t${++n}`;
}

const home: TabRef = { route: "home", params: {} };
const requests: TabRef = { route: "requests", params: {} };
const req = (id: string): TabRef => ({ route: "request", params: { id } });
const content = (id: string, key: string): TabRef => ({ route: "content", params: { id, key } });
const empty: TabsState = { tabs: [], activeId: null };

function openAll(refs: TabRef[], makeId = ids()): TabsState {
  return refs.reduce((state, ref) => openTab(state, ref, makeId).state, empty);
}

describe("openTab", () => {
  it("opens a new tab and activates it", () => {
    const result = openTab(empty, home, ids());
    expect(result.status).toBe("opened");
    expect(result.state.tabs).toHaveLength(1);
    expect(result.state.activeId).toBe(result.tabId);
  });

  it("reuses the tab of the same menu route", () => {
    const makeId = ids();
    const state = openAll([home, requests], makeId);
    const result = openTab(state, home, makeId);
    expect(result.status).toBe("activated");
    expect(result.state.tabs).toHaveLength(2);
    expect(result.state.activeId).toBe(state.tabs[0].id);
  });

  it("reuses request tabs per request id and content tabs per request + key", () => {
    const makeId = ids();
    let state = openAll([req("R1"), req("R2"), content("R1", "C1")], makeId);
    expect(state.tabs).toHaveLength(3);
    expect(openTab(state, req("R1"), makeId).status).toBe("activated");
    expect(openTab(state, content("R1", "C1"), makeId).status).toBe("activated");
    const other = openTab(state, content("R1", "C2"), makeId);
    expect(other.status).toBe("opened");
    state = other.state;
    expect(state.tabs).toHaveLength(4);
  });

  it(`refuses an 11th tab but still activates existing ones`, () => {
    const makeId = ids();
    const refs = Array.from({ length: MAX_TABS }, (_, i) => req(`R${i}`));
    const state = openAll(refs, makeId);
    expect(state.tabs).toHaveLength(MAX_TABS);
    const refused = openTab(state, home, makeId);
    expect(refused.status).toBe("limit");
    expect(refused.state).toBe(state);
    const existing = openTab(state, req("R0"), makeId);
    expect(existing.status).toBe("activated");
    expect(existing.state.activeId).toBe(state.tabs[0].id);
  });
});

describe("closeTab", () => {
  it("activates the right neighbour when the active tab closes", () => {
    const makeId = ids();
    let state = openAll([home, requests, req("R1")], makeId);
    state = activateTab(state, state.tabs[1].id);
    const next = closeTab(state, state.tabs[1].id, makeId);
    expect(next.tabs.map((t) => t.route)).toEqual(["home", "request"]);
    expect(next.activeId).toBe(state.tabs[2].id);
  });

  it("activates the left neighbour when the last tab was active", () => {
    const makeId = ids();
    const state = openAll([home, requests, req("R1")], makeId);
    const next = closeTab(state, state.tabs[2].id, makeId);
    expect(next.activeId).toBe(state.tabs[1].id);
  });

  it("keeps the active tab when another tab closes", () => {
    const makeId = ids();
    const state = openAll([home, requests, req("R1")], makeId);
    const next = closeTab(state, state.tabs[0].id, makeId);
    expect(next.activeId).toBe(state.tabs[2].id);
    expect(next.tabs).toHaveLength(2);
  });

  it("leaves a dashboard tab when the last tab closes", () => {
    const makeId = ids();
    const state = openAll([req("R1")], makeId);
    const next = closeTab(state, state.tabs[0].id, makeId);
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].route).toBe("home");
    expect(next.activeId).toBe(next.tabs[0].id);
  });

  it("ignores unknown ids", () => {
    const state = openAll([home]);
    expect(closeTab(state, "nope", ids())).toBe(state);
  });
});

describe("updateTab", () => {
  it("sets the dirty flag and title without touching other tabs", () => {
    const state = openAll([home, req("R1")]);
    const dirty = updateTab(state, state.tabs[1].id, { dirty: true });
    expect(dirty.tabs[1].dirty).toBe(true);
    expect(dirty.tabs[0]).toBe(state.tabs[0]);
    expect(updateTab(dirty, state.tabs[1].id, { dirty: true })).toBe(dirty);
    expect(updateTab(dirty, state.tabs[1].id, { title: "10월 혜택" }).tabs[1].title).toBe("10월 혜택");
  });
});

describe("persistence", () => {
  it("serialises route + params only", () => {
    const state = updateTab(openAll([home, req("R1")]), "t2", { dirty: true, title: "x" });
    expect(serializeTabs(state)).toEqual([home, req("R1")]);
  });

  it("restores at most 10 valid, unique refs", () => {
    const stored = [
      home,
      { route: "spec", params: {} },
      { route: "request", params: {} },
      home,
      ...Array.from({ length: 12 }, (_, i) => req(`R${i}`)),
    ];
    const restored = restoreTabs(stored, ids());
    expect(restored.tabs).toHaveLength(MAX_TABS);
    expect(restored.tabs[0].route).toBe("home");
    expect(restored.tabs.filter((t) => t.route === "home")).toHaveLength(1);
    expect(restored.activeId).toBeNull();
  });

  it("tolerates garbage", () => {
    expect(restoreTabs("x", ids()).tabs).toEqual([]);
    expect(restoreTabs(null, ids()).tabs).toEqual([]);
  });
});
