import type { Page, Route } from "@playwright/test";
import { API_SNAPSHOT, demoPersonas } from "./api-snapshot";

/** Normalised `path?query` key (sorted query params) so request order does not matter. */
function keyOf(pathWithQuery: string): string {
  const [path, query = ""] = pathWithQuery.split("?");
  const params = new URLSearchParams(query);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.length ? `${path}?${new URLSearchParams(sorted).toString()}` : path;
}

const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: body === undefined ? "" : JSON.stringify(body),
});

export interface MockWrite {
  method: string;
  /** Path after `/api`, with query. */
  path: string;
  /** Parsed JSON body (undefined for multipart or empty bodies). */
  body: unknown;
}

export interface MockApiOptions {
  /** Extra GET responses (`/path?query` → body), e.g. from `draft-snapshot.ts`. */
  extra?: Record<string, unknown>;
  /** Answers a write call; undefined falls back to 405. */
  onWrite?: (write: MockWrite) => { status: number; body?: unknown } | undefined;
}

/**
 * Serves the captured demo API (`api-snapshot.ts`) to the app as persona `userId`: the session
 * refresh returns that persona, GETs answer from the snapshot (plus `extra`), writes go to
 * `onWrite` (default 405).
 */
export async function mockApiAs(page: Page, userId: number, options: MockApiOptions = {}): Promise<void> {
  const responses = API_SNAPSHOT[userId];
  if (!responses) throw new Error(`no snapshot for user ${userId}`);
  const index = new Map(
    Object.entries({ ...responses, ...options.extra }).map(([k, v]) => [keyOf(k), v]),
  );
  const me = responses["/me"];

  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "") + url.search;
    const method = route.request().method();
    if (path.startsWith("/auth/refresh")) return route.fulfill(json(200, { accessToken: "fixture", me }));
    if (path.startsWith("/auth/demo-personas")) return route.fulfill(json(200, demoPersonas));
    if (method !== "GET") {
      let body: unknown;
      try {
        body = route.request().postDataJSON();
      } catch {
        body = undefined;
      }
      const answer = options.onWrite?.({ method, path, body });
      if (answer) return route.fulfill(json(answer.status, answer.body));
      return route.fulfill(json(405, { code: "INTERNAL", message: "fixture: read-only" }));
    }
    const body = index.get(keyOf(path));
    if (body === undefined) return route.fulfill(json(404, { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다" }));
    const status = (body as { __status?: number }).__status;
    return route.fulfill(json(status ?? 200, body));
  });
}
