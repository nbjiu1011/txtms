import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { request101U2 } from "@fixtures/api-snapshot";
import { useToastStore } from "@/shared/ui";
import { useWorkContextStore } from "@/entities/me";
import { NOTIFIED_REQUEST_DENIED, useOpenNotifiedRequest } from "./use-open-notified-request";

function respond(routes: Record<string, [number, unknown]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url, "http://x").pathname;
      const [status, body] = routes[path] ?? [404, { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다" }];
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const navigate = vi.fn();
  const { result } = renderHook(() => useOpenNotifiedRequest(navigate), { wrapper });
  return { open: result.current, navigate };
}

afterEach(() => {
  vi.unstubAllGlobals();
  useToastStore.getState().dismiss();
});

describe("useOpenNotifiedRequest", () => {
  it("switches the context to the request's customer/project and opens its tab", async () => {
    respond({
      "/api/requests/REQ-2609-101": [200, request101U2],
      "/api/projects/1": [200, { id: 1, customerId: 5, name: "p", active: true, leadUserId: 3, templates: [], senders: [], members: [], variablesRevision: 1 }],
    });
    useWorkContextStore.setState({ customerId: 1, projectId: 2 });
    const { open, navigate } = setup();
    let opened = false;
    await act(async () => {
      opened = await open("REQ-2609-101");
    });
    expect(opened).toBe(true);
    expect(useWorkContextStore.getState()).toMatchObject({ customerId: 5, projectId: 1 });
    expect(navigate).toHaveBeenCalledWith({ route: "request", params: { id: "REQ-2609-101" } });
  });

  it.each([403, 404])("shows the no-permission toast on %i and opens nothing", async (status) => {
    respond({ "/api/requests/REQ-2609-110": [status, { code: status === 403 ? "FORBIDDEN" : "NOT_FOUND", message: "x" }] });
    const { open, navigate } = setup();
    let opened = true;
    await act(async () => {
      opened = await open("REQ-2609-110");
    });
    expect(opened).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(useToastStore.getState().message).toBe(NOTIFIED_REQUEST_DENIED);
  });
});
