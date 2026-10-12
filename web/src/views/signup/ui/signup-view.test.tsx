import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { authApi } from "@/features/auth";
import { SignupView } from "./signup-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function renderView(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("SignupView", () => {
  it("draws the five stages with their owners and statuses, in order", async () => {
    vi.spyOn(authApi, "signupOptions").mockResolvedValue({ customers: [] });
    renderView(<SignupView />);

    const stages = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(stages.slice(0, 5)).toEqual(["요청 작성", "검수 배정", "검수", "승인선택", "완료 · 활용"]);
    const flow = screen.getByRole("region", { name: "업무 흐름" });
    expect(within(flow).getAllByText("대표 검수자").length).toBeGreaterThan(0);
    expect(within(flow).getAllByText("주담당").length).toBeGreaterThan(0);
    expect(within(flow).getAllByText("승인 대기").length).toBe(1);
    expect(screen.getByRole("region", { name: "준비" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("form", { name: "임시 가입" })).toBeTruthy());
  });

  it("explains that sign-up is closed when the API does not offer it", async () => {
    vi.spyOn(authApi, "signupOptions").mockRejectedValue(
      new ApiError(404, { code: "NOT_FOUND", message: "대상을 찾을 수 없습니다" }),
    );
    renderView(<SignupView />);
    await waitFor(() => expect(screen.getByText("임시 가입이 열려 있지 않습니다")).toBeTruthy());
    expect(screen.queryByRole("form", { name: "임시 가입" })).toBeNull();
    // the flow stays readable
    expect(screen.getByRole("region", { name: "업무 흐름" })).toBeTruthy();
  });
});
