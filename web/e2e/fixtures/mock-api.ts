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

/**
 * Serves the captured demo API (`api-snapshot.ts`) to the app as persona `userId`: the session
 * refresh returns that persona, GETs answer from the snapshot, everything else is 404/405 —
 * mutations are not part of this milestone.
 */
export async function mockApiAs(page: Page, userId: number): Promise<void> {
  const responses = API_SNAPSHOT[userId];
  if (!responses) throw new Error(`no snapshot for user ${userId}`);
  const index = new Map(Object.entries(responses).map(([k, v]) => [keyOf(k), v]));
  const me = responses["/me"];

  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "") + url.search;
    const method = route.request().method();
    if (path.startsWith("/auth/refresh")) return route.fulfill(json(200, { accessToken: "fixture", me }));
    if (path.startsWith("/auth/demo-personas")) return route.fulfill(json(200, demoPersonas));
    if (method !== "GET") return route.fulfill(json(405, { code: "INTERNAL", message: "fixture: read-only" }));
    const body = index.get(keyOf(path));
    if (body === undefined) return route.fulfill(json(404, { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다" }));
    const status = (body as { __status?: number }).__status;
    return route.fulfill(json(status ?? 200, body));
  });
}
