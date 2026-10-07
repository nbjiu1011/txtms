import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error";
import { getAccessToken, setAccessToken } from "./access-token";
import { __resetHttpClientForTests, buildUrl, configureHttpClient, http, refreshSession } from "./http-client";

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ME = { id: 1, name: "김서연" };
const fetchMock = vi.fn<typeof fetch>();

function calls(path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(`/api${path}`));
}

beforeEach(() => {
  __resetHttpClientForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildUrl", () => {
  it("prefixes the API base path and serialises query values", () => {
    expect(buildUrl("/requests", { projectId: 1, q: "", mine: true, status: ["DRAFT", "WAITING"], x: undefined })).toBe(
      "/api/requests?projectId=1&mine=true&status=DRAFT&status=WAITING",
    );
  });
});

describe("http client", () => {
  it("sends the bearer token and parses JSON", async () => {
    setAccessToken("t1");
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(http.get("/me")).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t1");
    expect(init?.credentials).toBe("same-origin");
  });

  it("maps error bodies to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, {
        code: "REQUEST_STATE_CONFLICT",
        message: "권한 또는 요청 상태가 변경되었습니다",
        fieldErrors: [{ field: "title", message: "제목을(를) 입력하세요" }],
        details: ["요청 정보: 제목"],
      }),
    );
    const error = await http.post("/requests/R1/submit", { rowVersion: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "REQUEST_STATE_CONFLICT",
      fieldErrors: [{ field: "title", message: "제목을(를) 입력하세요" }],
      details: ["요청 정보: 제목"],
    });
  });

  it("refreshes once on 401 and retries the call with the new token", async () => {
    setAccessToken("old");
    const onRefreshed = vi.fn();
    configureHttpClient({ onRefreshed });
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "x" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new", me: ME }))
      .mockResolvedValueOnce(json(200, { id: 7 }));

    await expect(http.get("/requests/R1")).resolves.toEqual({ id: 7 });
    expect(calls("/auth/refresh")).toHaveLength(1);
    expect(getAccessToken()).toBe("new");
    expect(onRefreshed).toHaveBeenCalledWith({ accessToken: "new", me: ME });
    const retryInit = fetchMock.mock.calls[2][1];
    expect((retryInit?.headers as Record<string, string>).Authorization).toBe("Bearer new");
  });

  it("gives up after one failed refresh and reports the expired session", async () => {
    setAccessToken("old");
    const onUnauthenticated = vi.fn();
    configureHttpClient({ onUnauthenticated });
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "x" }))
      .mockResolvedValueOnce(json(401, { code: "SESSION_EXPIRED", message: "세션이 만료되었습니다" }));

    const error = await http.get("/me").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(onUnauthenticated.mock.calls[0][0]).toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("does not loop when the retried call is still unauthorised", async () => {
    const onUnauthenticated = vi.fn();
    configureHttpClient({ onUnauthenticated });
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "x" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new", me: ME }))
      .mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "y" }));

    await expect(http.get("/me")).rejects.toMatchObject({ status: 401, message: "y" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("shares a single refresh between concurrent 401s", async () => {
    let resolveRefresh: (r: Response) => void = () => {};
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return new Promise<Response>((resolve) => (resolveRefresh = resolve));
      if (getAccessToken() === "new") return Promise.resolve(json(200, { url }));
      return Promise.resolve(json(401, { code: "UNAUTHENTICATED", message: "x" }));
    });

    const a = http.get("/a");
    const b = http.get("/b");
    await vi.waitFor(() => expect(calls("/auth/refresh")).toHaveLength(1));
    resolveRefresh(json(200, { accessToken: "new", me: ME }));
    await expect(Promise.all([a, b])).resolves.toEqual([{ url: "/api/a" }, { url: "/api/b" }]);
    expect(calls("/auth/refresh")).toHaveLength(1);
  });

  it("skips token and refresh for public calls", async () => {
    setAccessToken("t1");
    const onUnauthenticated = vi.fn();
    configureHttpClient({ onUnauthenticated });
    fetchMock.mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "이메일 또는 비밀번호를 확인하세요" }));
    await expect(http.post("/auth/login", { email: "a@b.c" }, { auth: false })).rejects.toMatchObject({
      message: "이메일 또는 비밀번호를 확인하세요",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("refreshSession resolves null without a session and never calls onUnauthenticated", async () => {
    const onUnauthenticated = vi.fn();
    configureHttpClient({ onUnauthenticated });
    fetchMock.mockResolvedValueOnce(json(401, { code: "UNAUTHENTICATED", message: "x" }));
    await expect(refreshSession()).resolves.toBeNull();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("turns network failures into NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(http.get("/me")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
