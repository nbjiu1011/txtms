import { env } from "@/shared/config/env";
import { ApiError, toApiErrorBody } from "./api-error";
import { getAccessToken, setAccessToken } from "./access-token";

/** `{ accessToken, me }` returned by login / refresh / token-password endpoints. */
export interface SessionPayload<TMe = unknown> {
  accessToken: string;
  me: TMe;
}

export interface HttpHandlers {
  /** Called after a successful token refresh (start-up or silent retry). */
  onRefreshed?: (payload: SessionPayload) => void;
  /** Called when an authenticated call fails with 401 and the single refresh attempt also failed. */
  onUnauthenticated?: (error: ApiError) => void;
}

let handlers: HttpHandlers = {};

/** Wires session side effects (store update, redirect, toast). Called once by the app providers. */
export function configureHttpClient(next: HttpHandlers): void {
  handlers = next;
}

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: QueryParams;
  /** JSON-serialisable body or FormData (multipart). */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Attach the bearer token and retry once after refresh on 401. Default true. */
  auth?: boolean;
  /** Let the call outlive the page (unload clean-up such as releasing an edit lock). */
  keepalive?: boolean;
}

const REFRESH_PATH = "/auth/refresh";

export function buildUrl(path: string, query?: QueryParams): string {
  const base = env.NEXT_PUBLIC_API_BASE_PATH.replace(/\/+$/, "");
  const search = new URLSearchParams();
  if (query) {
    for (const [key, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (value === undefined || value === null || value === "") continue;
        search.append(key, String(value));
      }
    }
  }
  const qs = search.toString();
  return `${base}${path.startsWith("/") ? path : `/${path}`}${qs ? `?${qs}` : ""}`;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }
  return text;
}

async function send(path: string, options: RequestOptions, withAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const token = withAuth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body,
      credentials: "same-origin",
      signal: options.signal,
      keepalive: options.keepalive,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요" });
  }
}

let refreshInFlight: Promise<SessionPayload | null> | null = null;
let lastRefreshError: ApiError | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share
 * one network call. Resolves null when there is no valid session.
 */
export function refreshSession(): Promise<SessionPayload | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await send(REFRESH_PATH, { method: "POST" }, false);
        const payload = await readBody(response);
        if (!response.ok) {
          lastRefreshError = new ApiError(response.status, toApiErrorBody(response.status, payload));
          setAccessToken(null);
          return null;
        }
        const session = payload as SessionPayload;
        lastRefreshError = null;
        setAccessToken(session.accessToken);
        handlers.onRefreshed?.(session);
        return session;
      } catch (error) {
        lastRefreshError = error instanceof ApiError ? error : null;
        setAccessToken(null);
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Ends the session after an authenticated call failed with 401 and the refresh also failed
 * (shared by the fetch client and the XHR upload client).
 */
export function endSession(error: ApiError): void {
  setAccessToken(null);
  handlers.onUnauthenticated?.(lastRefreshError?.code === "SESSION_EXPIRED" ? lastRefreshError : error);
}

/** Sends a call with the bearer token; on 401 refreshes once (shared) and retries. */
async function sendWithAuth(path: string, options: RequestOptions): Promise<Response> {
  const withAuth = options.auth !== false;
  let response = await send(path, options, withAuth);

  if (response.status === 401 && withAuth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send(path, options, true);
    }
    if (response.status === 401) {
      const payload = await readBody(response);
      const error = new ApiError(401, toApiErrorBody(401, payload));
      endSession(error);
      throw error;
    }
  }
  return response;
}

/** Performs an API call. Throws `ApiError` for every non-2xx response. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await sendWithAuth(path, options);
  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, toApiErrorBody(response.status, payload));
  }
  return payload as T;
}

function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

/**
 * Downloads a binary endpoint with the in-memory bearer token (a plain link cannot carry it) and
 * saves it under the server's file name (`Content-Disposition`) or `fallbackName`.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await sendWithAuth(path, { headers: { Accept: "*/*" } });
  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(response.status, toApiErrorBody(response.status, payload));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFrom(response.headers.get("content-disposition")) ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Binary GET with the bearer token (e.g. an image shown through an object URL). */
export async function getBlob(path: string, options?: Pick<RequestOptions, "signal">): Promise<Blob> {
  const response = await sendWithAuth(path, { headers: { Accept: "*/*" }, signal: options?.signal });
  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(response.status, toApiErrorBody(response.status, payload));
  }
  return response.blob();
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

/** Test helper: resets module state between tests. */
export function __resetHttpClientForTests(): void {
  handlers = {};
  refreshInFlight = null;
  lastRefreshError = null;
  setAccessToken(null);
}
