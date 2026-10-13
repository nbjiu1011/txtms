import { describe, expect, it } from "vitest";
import { ROUTE_KEYS, ROUTES, isValidTabRef, pathToTab, tabIdentity, tabToPath, type TabRef } from "./routes";

describe("pathToTab", () => {
  it.each([
    ["/", "home"],
    ["/requests", "requests"],
    ["/review", "review"],
    ["/approval", "approval"],
    ["/contents", "contents"],
    ["/performance", "performance"],
    ["/notices", "notices"],
    ["/admin/projects", "adminProjects"],
    ["/admin/variables", "adminVariables"],
    ["/admin/users", "adminUsers"],
    ["/admin/customer", "adminCustomer"],
    ["/admin/notices", "adminNotices"],
    ["/ops/customers", "opsCustomers"],
    ["/ops/setup", "opsSetup"],
    ["/ops/standards", "opsStandards"],
    ["/profile", "profile"],
  ])("maps %s to %s", (path, route) => {
    expect(pathToTab(path)).toEqual({ route, params: {} });
  });

  it("parses request and content paths", () => {
    expect(pathToTab("/requests/REQ-2610-121")).toEqual({ route: "request", params: { id: "REQ-2610-121" } });
    expect(pathToTab("/requests/REQ-2610-121/contents/C2")).toEqual({
      route: "content",
      params: { id: "REQ-2610-121", key: "C2" },
    });
  });

  it("parses notice detail paths", () => {
    expect(pathToTab("/notices/7")).toEqual({ route: "notice", params: { id: "7" } });
    expect(pathToTab("/admin/notices/7")).toEqual({ route: "adminNotice", params: { id: "7" } });
    expect(pathToTab("/notices/x")).toBeNull();
    expect(pathToTab("/admin/notices/7/logs")).toBeNull();
  });

  it("parses customer detail paths (numeric ids only)", () => {
    expect(pathToTab("/ops/customers/12")).toEqual({ route: "opsCustomer", params: { id: "12" } });
    expect(pathToTab("/ops/customers/abc")).toBeNull();
    expect(pathToTab("/ops/customers/0")).toBeNull();
    expect(pathToTab("/ops/customers/1/x")).toBeNull();
  });

  it("ignores trailing slashes, query and hash", () => {
    expect(pathToTab("/requests/")).toEqual({ route: "requests", params: {} });
    expect(pathToTab("/requests/REQ-1?x=1#y")).toEqual({ route: "request", params: { id: "REQ-1" } });
  });

  it("decodes encoded segments", () => {
    expect(pathToTab("/requests/REQ%201")).toEqual({ route: "request", params: { id: "REQ 1" } });
  });

  it("returns null for unknown paths", () => {
    expect(pathToTab("/nope")).toBeNull();
    expect(pathToTab("/admin")).toBeNull();
    expect(pathToTab("/requests/REQ-1/contents")).toBeNull();
    expect(pathToTab("/requests/REQ-1/history")).toBeNull();
    expect(pathToTab("/requests/%E0%A4%A")).toBeNull();
    expect(pathToTab("/login")).toBeNull();
  });
});

describe("tabToPath", () => {
  it("round-trips every route", () => {
    for (const route of ROUTE_KEYS) {
      const ref: TabRef =
        route === "request"
          ? { route, params: { id: "REQ-2609-101" } }
          : route === "content"
            ? { route, params: { id: "REQ-2609-101", key: "C1" } }
            : route === "opsCustomer" || route === "notice" || route === "adminNotice" || route === "adminUser"
              ? { route, params: { id: "3" } }
              : { route, params: {} };
      expect(pathToTab(tabToPath(ref))).toEqual(ref);
    }
  });

  it("encodes ids", () => {
    expect(tabToPath({ route: "request", params: { id: "A/B" } })).toBe("/requests/A%2FB");
  });
});

describe("tabIdentity", () => {
  it("reuses per request, per request content, and per menu route", () => {
    expect(tabIdentity({ route: "request", params: { id: "R1" } })).toBe("request:R1");
    expect(tabIdentity({ route: "content", params: { id: "R1", key: "C1" } })).toBe("content:R1:C1");
    expect(tabIdentity({ route: "requests", params: {} })).toBe("requests");
    expect(tabIdentity({ route: "opsCustomer", params: { id: "3" } })).toBe("opsCustomer:3");
    expect(tabIdentity({ route: "notice", params: { id: "3" } })).toBe("notice:3");
    expect(tabIdentity({ route: "adminNotice", params: { id: "3" } })).toBe("adminNotice:3");
  });
});

describe("isValidTabRef", () => {
  it("accepts well-formed refs and rejects the rest", () => {
    expect(isValidTabRef({ route: "home", params: {} })).toBe(true);
    expect(isValidTabRef({ route: "request", params: { id: "R1" } })).toBe(true);
    expect(isValidTabRef({ route: "request", params: {} })).toBe(false);
    expect(isValidTabRef({ route: "content", params: { id: "R1" } })).toBe(false);
    expect(isValidTabRef({ route: "opsCustomer", params: { id: "3" } })).toBe(true);
    expect(isValidTabRef({ route: "opsCustomer", params: { id: "x" } })).toBe(false);
    expect(isValidTabRef({ route: "opsCustomer", params: {} })).toBe(false);
    expect(isValidTabRef({ route: "spec", params: {} })).toBe(false);
    expect(isValidTabRef(null)).toBe(false);
    expect(isValidTabRef("home")).toBe(false);
  });
});

describe("ROUTES", () => {
  it("has no prototype-only screens", () => {
    expect(Object.values(ROUTES).map((r) => r.title)).not.toContain("기능 대응표");
  });
});
