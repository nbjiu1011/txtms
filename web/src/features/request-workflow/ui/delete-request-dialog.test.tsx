import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { requestApi } from "@/entities/request";
import { DeleteRequestDialog } from "./delete-request-dialog";

afterEach(() => {
  vi.restoreAllMocks();
  useToastStore.getState().dismiss();
});

const lastToast = () => useToastStore.getState().message;

describe("DeleteRequestDialog", () => {
  it("deletes after confirmation and reports it", async () => {
    const remove = vi.spyOn(requestApi, "remove").mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<DeleteRequestDialog open onClose={vi.fn()} requestId="REQ-1" onDeleted={onDeleted} onStale={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "REQ-1 요청을 삭제할까요?" })).toBeTruthy();
    expect(screen.getByText("삭제한 요청은 되돌릴 수 없습니다. 콘텐츠와 첨부파일도 함께 삭제됩니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith("REQ-1");
    expect(lastToast()).toBe("요청을 삭제했습니다");
  });

  it("a request that can no longer be deleted reloads the page", async () => {
    vi.spyOn(requestApi, "remove").mockRejectedValue(
      new ApiError(409, { code: "REQUEST_STATE_CONFLICT", message: "현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다" }),
    );
    const onDeleted = vi.fn();
    const onStale = vi.fn();
    render(<DeleteRequestDialog open onClose={vi.fn()} requestId="REQ-1" onDeleted={onDeleted} onStale={onStale} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onStale).toHaveBeenCalled());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(lastToast()).toBe("현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다");
  });
});
