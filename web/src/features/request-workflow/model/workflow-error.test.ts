import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { STATE_CHANGED_MESSAGE, handleWorkflowError } from "./workflow-error";

vi.mock("@/shared/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ui")>()),
  toast: vi.fn(),
}));

const err = (status: number, code: string, message = "msg") => new ApiError(status, { code, message });

describe("handleWorkflowError", () => {
  afterEach(() => vi.mocked(toast).mockClear());

  it("REQUEST_STATE_CONFLICT: reference toast, reload, close", () => {
    const stale = vi.fn();
    expect(handleWorkflowError(err(409, "REQUEST_STATE_CONFLICT", "현재 역할과 요청 상태에서"), stale)).toBe("close");
    expect(toast).toHaveBeenCalledWith(STATE_CHANGED_MESSAGE);
    expect(stale).toHaveBeenCalled();
  });

  it("NO_ELIGIBLE_APPROVER / LOCKED_BY_OTHER: server message, reload, close", () => {
    for (const code of ["NO_ELIGIBLE_APPROVER", "LOCKED_BY_OTHER"]) {
      const stale = vi.fn();
      expect(handleWorkflowError(err(409, code, `${code} 문구`), stale)).toBe("close");
      expect(toast).toHaveBeenLastCalledWith(`${code} 문구`);
      expect(stale).toHaveBeenCalled();
    }
  });

  it("VALIDATION_FAILED keeps the modal open for a fix", () => {
    const stale = vi.fn();
    expect(handleWorkflowError(err(400, "VALIDATION_FAILED", "변경 사유을(를) 입력하세요"), stale)).toBe("keepOpen");
    expect(toast).toHaveBeenCalledWith("변경 사유을(를) 입력하세요");
    expect(stale).not.toHaveBeenCalled();
  });

  it("network errors keep the modal open (retry)", () => {
    expect(handleWorkflowError(err(0, "NETWORK_ERROR", "서버에 연결할 수 없습니다"), vi.fn())).toBe("keepOpen");
  });
});
