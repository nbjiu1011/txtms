import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { authApi } from "@/features/auth";
import { EMAIL_CHANGED_MESSAGE, EMAIL_CHANGE_INVALID_MESSAGE, EmailChangeView } from "./email-change-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }) }));

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("EmailChangeView", () => {
  it("shows the new address, confirms it and then points to the login", async () => {
    vi.spyOn(authApi, "tokenInfo").mockResolvedValue({
      kind: "EMAIL_CHANGE",
      valid: true,
      email: "new@hanbitcard.co.kr",
      name: "김서연",
    });
    const confirm = vi.spyOn(authApi, "confirmEmailChange").mockResolvedValue(undefined);
    wrap(<EmailChangeView token="tok-1" />);

    expect(await screen.findByText("new@hanbitcard.co.kr")).toBeTruthy();
    expect(screen.getByText(/김서연님의 로그인 이메일이 아래 주소로 바뀝니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "이메일 변경 확인" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("tok-1"));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", EMAIL_CHANGED_MESSAGE);
    expect(screen.queryByRole("button", { name: "이메일 변경 확인" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "로그인으로 이동" }));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("shows the invalid state for an invalid link without a confirm button", async () => {
    vi.spyOn(authApi, "tokenInfo").mockResolvedValue({ kind: "EMAIL_CHANGE", valid: false });
    wrap(<EmailChangeView token="used" />);
    expect(await screen.findByText(EMAIL_CHANGE_INVALID_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "이메일 변경 확인" })).toBeNull();
    expect(screen.getByRole("button", { name: "로그인으로 돌아가기" })).toBeTruthy();
  });

  it("does not accept another kind of link", async () => {
    vi.spyOn(authApi, "tokenInfo").mockResolvedValue({ kind: "INVITATION", valid: true, email: "a@b.kr", name: "가" });
    wrap(<EmailChangeView token="invite-token" />);
    expect(await screen.findByText(EMAIL_CHANGE_INVALID_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "이메일 변경 확인" })).toBeNull();
  });

  it("shows the server refusal (address taken meanwhile) and keeps the button", async () => {
    vi.spyOn(authApi, "tokenInfo").mockResolvedValue({ kind: "EMAIL_CHANGE", valid: true, email: "x@b.kr", name: "가" });
    vi.spyOn(authApi, "confirmEmailChange").mockRejectedValue(
      new ApiError(409, { code: "DUPLICATE", message: "이메일 형식 또는 중복을 확인하세요" }),
    );
    wrap(<EmailChangeView token="tok-2" />);
    fireEvent.click(await screen.findByRole("button", { name: "이메일 변경 확인" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "이메일 형식 또는 중복을 확인하세요");
    expect(screen.getByRole("button", { name: "이메일 변경 확인" })).toBeTruthy();
  });

  it("turns a link refused on confirmation (expired or used) into the invalid state", async () => {
    vi.spyOn(authApi, "tokenInfo").mockResolvedValue({ kind: "EMAIL_CHANGE", valid: true, email: "x@b.kr", name: "가" });
    vi.spyOn(authApi, "confirmEmailChange").mockRejectedValue(
      new ApiError(400, { code: "VALIDATION_FAILED", message: "유효하지 않은 링크입니다" }),
    );
    wrap(<EmailChangeView token="tok-3" />);
    fireEvent.click(await screen.findByRole("button", { name: "이메일 변경 확인" }));
    expect(await screen.findByText(EMAIL_CHANGE_INVALID_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "이메일 변경 확인" })).toBeNull();
  });

  it("waits for the route param", () => {
    wrap(<EmailChangeView token={null} />);
    expect(screen.getByText("링크를 확인하고 있습니다.")).toBeTruthy();
  });
});
