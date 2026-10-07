/**
 * Work-tab routes of the authenticated app and their URL scheme.
 * The URL is the source of truth for the active tab: `pathToTab` parses a pathname,
 * `tabToPath` builds one. Auth pages live outside the tab model (see AUTH_PATHS).
 */

export const ROUTE_KEYS = [
  "home",
  "requests",
  "request",
  "content",
  "review",
  "approval",
  "contents",
  "performance",
  "notices",
  "adminProjects",
  "adminVariables",
  "adminUsers",
  "adminCustomer",
  "adminNotices",
  "opsCustomers",
  "opsSetup",
  "opsStandards",
  "profile",
] as const;

export type RouteKey = (typeof ROUTE_KEYS)[number];

export type MenuGroup = "work" | "admin" | "ops";

/** Who may open the route (evaluated against the current customer/project context). */
export type RouteAccess = "always" | "reviewer" | "approver" | "performance" | "admin" | "ops";

export type RouteIcon =
  | "home"
  | "req"
  | "review"
  | "appr"
  | "box"
  | "chart"
  | "mega"
  | "folder"
  | "brace"
  | "users"
  | "build"
  | "cust"
  | "seed"
  | "book";

export interface RouteDef {
  key: RouteKey;
  title: string;
  icon: RouteIcon | null;
  group: MenuGroup | null;
  access: RouteAccess;
  /** View implemented in this build. Menus and the add-tab popover list only enabled routes. */
  enabled: boolean;
}

export const ROUTES: Record<RouteKey, RouteDef> = {
  home: { key: "home", title: "대시보드", icon: "home", group: "work", access: "always", enabled: true },
  requests: { key: "requests", title: "요청", icon: "req", group: "work", access: "always", enabled: true },
  request: { key: "request", title: "요청", icon: null, group: null, access: "always", enabled: true },
  content: { key: "content", title: "콘텐츠", icon: null, group: null, access: "always", enabled: true },
  review: { key: "review", title: "검수", icon: "review", group: "work", access: "reviewer", enabled: true },
  approval: { key: "approval", title: "승인", icon: "appr", group: "work", access: "approver", enabled: true },
  contents: { key: "contents", title: "콘텐츠", icon: "box", group: "work", access: "always", enabled: true },
  performance: {
    key: "performance",
    title: "업무량·실적",
    icon: "chart",
    group: "work",
    access: "performance",
    enabled: false,
  },
  notices: { key: "notices", title: "공지", icon: "mega", group: "work", access: "always", enabled: false },
  adminProjects: {
    key: "adminProjects",
    title: "프로젝트 관리",
    icon: "folder",
    group: "admin",
    access: "admin",
    enabled: false,
  },
  adminVariables: {
    key: "adminVariables",
    title: "변수 관리",
    icon: "brace",
    group: "admin",
    access: "admin",
    enabled: false,
  },
  adminUsers: {
    key: "adminUsers",
    title: "사용자·권한 관리",
    icon: "users",
    group: "admin",
    access: "admin",
    enabled: false,
  },
  adminCustomer: {
    key: "adminCustomer",
    title: "고객사 설정",
    icon: "build",
    group: "admin",
    access: "admin",
    enabled: false,
  },
  adminNotices: {
    key: "adminNotices",
    title: "공지 관리",
    icon: "mega",
    group: "admin",
    access: "admin",
    enabled: false,
  },
  opsCustomers: {
    key: "opsCustomers",
    title: "고객사 관리",
    icon: "cust",
    group: "ops",
    access: "ops",
    enabled: false,
  },
  opsSetup: { key: "opsSetup", title: "초기 설정·시드", icon: "seed", group: "ops", access: "ops", enabled: false },
  opsStandards: {
    key: "opsStandards",
    title: "유형·교정 기준",
    icon: "book",
    group: "ops",
    access: "ops",
    enabled: false,
  },
  profile: { key: "profile", title: "내 설정", icon: null, group: null, access: "always", enabled: true },
};

export const WORK_MENU: readonly RouteKey[] = [
  "home",
  "requests",
  "review",
  "approval",
  "contents",
  "performance",
  "notices",
];
export const ADMIN_MENU: readonly RouteKey[] = [
  "adminProjects",
  "adminVariables",
  "adminUsers",
  "adminCustomer",
  "adminNotices",
];
export const OPS_MENU: readonly RouteKey[] = ["opsCustomers", "opsSetup", "opsStandards"];

export interface TabParams {
  /** Request id (`REQ-2610-121`) for `request` / `content`. */
  id?: string;
  /** Content key (`C1`) for `content`. */
  key?: string;
}

/** Persistable reference to a work tab: route + params only. */
export interface TabRef {
  route: RouteKey;
  params: TabParams;
}

const STATIC_PATHS: Partial<Record<RouteKey, string>> = {
  home: "/",
  requests: "/requests",
  review: "/review",
  approval: "/approval",
  contents: "/contents",
  performance: "/performance",
  notices: "/notices",
  adminProjects: "/admin/projects",
  adminVariables: "/admin/variables",
  adminUsers: "/admin/users",
  adminCustomer: "/admin/customer",
  adminNotices: "/admin/notices",
  opsCustomers: "/ops/customers",
  opsSetup: "/ops/setup",
  opsStandards: "/ops/standards",
  profile: "/profile",
};

const PATH_TO_STATIC = new Map<string, RouteKey>(
  Object.entries(STATIC_PATHS).map(([key, path]) => [path as string, key as RouteKey]),
);

export const AUTH_PATHS = {
  login: "/login",
  invite: (token: string) => `/invite/${encodeURIComponent(token)}`,
  reset: (token: string) => `/reset/${encodeURIComponent(token)}`,
} as const;

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Parses an app pathname into a tab reference. Returns null for unknown paths. */
export function pathToTab(pathname: string): TabRef | null {
  const clean = pathname.split(/[?#]/)[0] ?? "";
  const trimmed = clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
  const path = trimmed === "" ? "/" : trimmed;

  const staticRoute = PATH_TO_STATIC.get(path);
  if (staticRoute) return { route: staticRoute, params: {} };

  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "requests") return null;
  if (parts.length === 2) {
    const id = safeDecode(parts[1]);
    return id ? { route: "request", params: { id } } : null;
  }
  if (parts.length === 4 && parts[2] === "contents") {
    const id = safeDecode(parts[1]);
    const key = safeDecode(parts[3]);
    return id && key ? { route: "content", params: { id, key } } : null;
  }
  return null;
}

/** Builds the pathname for a tab reference. */
export function tabToPath(tab: TabRef): string {
  if (tab.route === "request") {
    return `/requests/${encodeURIComponent(tab.params.id ?? "")}`;
  }
  if (tab.route === "content") {
    return `/requests/${encodeURIComponent(tab.params.id ?? "")}/contents/${encodeURIComponent(tab.params.key ?? "")}`;
  }
  return STATIC_PATHS[tab.route] ?? "/";
}

/** Identity used for tab reuse: one tab per request, per request content, or per menu route. */
export function tabIdentity(tab: TabRef): string {
  if (tab.route === "request") return `request:${tab.params.id ?? ""}`;
  if (tab.route === "content") return `content:${tab.params.id ?? ""}:${tab.params.key ?? ""}`;
  return tab.route;
}

export function isRouteKey(value: unknown): value is RouteKey {
  return typeof value === "string" && (ROUTE_KEYS as readonly string[]).includes(value);
}

/** Validates a persisted tab reference (from localStorage). */
export function isValidTabRef(value: unknown): value is TabRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as { route?: unknown; params?: unknown };
  if (!isRouteKey(ref.route)) return false;
  const params = (ref.params ?? {}) as TabParams;
  if (typeof params !== "object") return false;
  if (ref.route === "request") return typeof params.id === "string" && params.id.length > 0;
  if (ref.route === "content") {
    return typeof params.id === "string" && params.id.length > 0 && typeof params.key === "string" && params.key.length > 0;
  }
  return true;
}
