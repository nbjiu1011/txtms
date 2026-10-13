import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { requestApi, requestKeys, type RequestDetail } from "@/entities/request";
import { request088U1 } from "@fixtures/api-snapshot";
import { FOLLOW_UP_CREATED, useRequestCreate } from "./use-request-create";

vi.mock("@/shared/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ui")>()),
  toast: vi.fn(),
}));

function setup(canOpenTab = () => true) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const open = vi.fn();
  const { result } = renderHook(() => useRequestCreate(open, canOpenTab), { wrapper });
  return { client, open, result };
}

const draft = { ...request088U1, id: "REQ-2610-130", status: "DRAFT", bundle: null } as RequestDetail;

describe("useRequestCreate.followUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast).mockClear();
  });

  it("whole request: posts a null content key, stores the draft and opens its tab", async () => {
    const call = vi.spyOn(requestApi, "followUp").mockResolvedValue(draft);
    const { client, open, result } = setup();
    await act(() => result.current.followUp("REQ-2609-088"));
    expect(call).toHaveBeenCalledWith("REQ-2609-088", null);
    expect(toast).toHaveBeenCalledWith(FOLLOW_UP_CREATED);
    expect(open).toHaveBeenCalledWith("REQ-2610-130");
    expect(client.getQueryData(requestKeys.detail("REQ-2610-130"))).toEqual(draft);
  });

  it("one item: posts its content key", async () => {
    const call = vi.spyOn(requestApi, "followUp").mockResolvedValue(draft);
    const { result } = setup();
    await act(() => result.current.followUp("REQ-2609-088", "C1"));
    expect(call).toHaveBeenCalledWith("REQ-2609-088", "C1");
  });

  it("shows the server message and opens nothing when refused", async () => {
    vi.spyOn(requestApi, "followUp").mockRejectedValue(
      new ApiError(409, { code: "REQUEST_STATE_CONFLICT", message: "현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다" }),
    );
    const { open, result } = setup();
    await act(() => result.current.followUp("REQ-2609-088", "C9"));
    expect(toast).toHaveBeenCalledWith("현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("useRequestCreate tab limit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates nothing while no work tab can be opened for it", async () => {
    const create = vi.spyOn(requestApi, "create").mockResolvedValue(draft);
    const clone = vi.spyOn(requestApi, "clone").mockResolvedValue(draft);
    const { open, result } = setup(() => false);
    await act(() => result.current.create(1));
    await act(() => result.current.clone("REQ-2609-088"));
    await act(() => result.current.followUp("REQ-2609-088"));
    expect(create).not.toHaveBeenCalled();
    expect(clone).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("creates and opens the draft when a tab can be opened", async () => {
    const create = vi.spyOn(requestApi, "create").mockResolvedValue(draft);
    const { open, result } = setup(() => true);
    await act(() => result.current.create(1));
    expect(create).toHaveBeenCalledWith({ projectId: 1 });
    expect(open).toHaveBeenCalledWith("REQ-2610-130");
  });
});
