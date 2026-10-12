import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { meApi } from "@/entities/me";
import { PasswordChangeForm } from "./password-change-form";

const lastToast = () => useToastStore.getState().message;

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
}

const alerts = () => screen.queryAllByRole("alert").map((el) => el.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  useToastStore.getState().dismiss();
});

describe("PasswordChangeForm", () => {
  it("validates inline before calling the API", async () => {
    const change = vi.spyOn(meApi, "changePassword").mockResolvedValue(undefined);
    render(<PasswordChangeForm />);

    fill("", "short", "other");
    await waitFor(() =>
      expect(alerts()).toEqual([
        "현재 비밀번호를 입력하세요",
        "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다",
        "새 비밀번호가 일치하지 않습니다",
      ]),
    );
    expect(screen.getByLabelText("현재 비밀번호").getAttribute("aria-invalid")).toBe("true");

    fill("Txtms!2026", "Txtms!2026", "Txtms!2026");
    await waitFor(() => expect(alerts()).toEqual(["현재 비밀번호와 다른 비밀번호를 입력하세요"]));
    expect(change).not.toHaveBeenCalled();
  });

  it("sends the contract body, toasts and clears the form", async () => {
    const change = vi.spyOn(meApi, "changePassword").mockResolvedValue(undefined);
    render(<PasswordChangeForm />);
    fill("Txtms!2026", "Changed#2026", "Changed#2026");

    await waitFor(() => expect(lastToast()).toBe("비밀번호를 변경했습니다"));
    expect(change).toHaveBeenCalledWith({ currentPassword: "Txtms!2026", newPassword: "Changed#2026" });
    expect((screen.getByLabelText("현재 비밀번호") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("새 비밀번호 확인") as HTMLInputElement).value).toBe("");
  });

  it("shows the server's wrong current password under the field", async () => {
    vi.spyOn(meApi, "changePassword").mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "현재 비밀번호가 일치하지 않습니다",
        fieldErrors: [{ field: "currentPassword", message: "현재 비밀번호가 일치하지 않습니다" }],
      }),
    );
    render(<PasswordChangeForm />);
    fill("Wrong!2026", "Changed#2026", "Changed#2026");

    await waitFor(() => expect(alerts()).toEqual(["현재 비밀번호가 일치하지 않습니다"]));
    expect(lastToast()).toBeNull();
    // the typed values stay so the user can correct the current password
    expect((screen.getByLabelText("새 비밀번호") as HTMLInputElement).value).toBe("Changed#2026");
  });

  it("toasts refusals without a field (rate limit)", async () => {
    vi.spyOn(meApi, "changePassword").mockRejectedValue(
      new ApiError(429, { code: "RATE_LIMITED", message: "비밀번호 확인에 여러 번 실패해 잠시 잠겼습니다." }),
    );
    render(<PasswordChangeForm />);
    fill("Wrong!2026", "Changed#2026", "Changed#2026");
    await waitFor(() => expect(lastToast()).toBe("비밀번호 확인에 여러 번 실패해 잠시 잠겼습니다."));
    expect(alerts()).toEqual([]);
  });
});
