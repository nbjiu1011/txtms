import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_SNAPSHOT, demoPersonas } from "@fixtures/api-snapshot";
import type { Me } from "@/entities/me";
import { authApi } from "@/features/auth";
import { UserPopover } from "./user-popover";

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  logout: logoutMock,
}));

const snapshotMe = API_SNAPSHOT[1]["/me"] as Me;

function setup(me: Me) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  const props = { onClose: vi.fn(), onOpenProfile: vi.fn(), onSwitched: vi.fn() };
  const wrap = (node: ReactNode) => <QueryClientProvider client={client}>{node}</QueryClientProvider>;
  render(wrap(<UserPopover open anchor={anchor} me={me} {...props} />));
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
  logoutMock.mockReset();
});

describe("UserPopover", () => {
  it("offers 내 설정 and 로그아웃 to an email/password session without asking for personas", () => {
    const personas = vi.spyOn(authApi, "demoPersonas").mockResolvedValue(demoPersonas);
    const props = setup({ ...snapshotMe, demo: false });

    const dialog = screen.getByRole("dialog", { name: "내 계정" });
    expect(within(dialog).getByText(snapshotMe.email)).toBeTruthy();
    const items = within(dialog).getAllByRole("button").map((b) => b.textContent);
    expect(items).toEqual(["내 설정", "로그아웃"]);
    expect(within(dialog).queryByText("체험 계정 바꾸기")).toBeNull();
    expect(personas).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "내 설정" }));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "로그아웃" }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("keeps 내 설정 and 로그아웃 in a demo persona session and lists the personas below", async () => {
    vi.spyOn(authApi, "demoPersonas").mockResolvedValue(demoPersonas);
    setup({ ...snapshotMe, demo: true });

    const dialog = screen.getByRole("dialog", { name: "내 계정" });
    expect(await within(dialog).findByText("체험 계정 바꾸기")).toBeTruthy();
    const items = within(dialog).getAllByRole("button");
    expect(items[0].textContent).toBe("내 설정");
    expect(items[1].textContent).toBe("로그아웃");
    expect(items).toHaveLength(2 + demoPersonas.length);
    expect(within(dialog).getByText("현재")).toBeTruthy();
  });
});
