import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, downloadFile } from "@/shared/api";
import { toast } from "@/shared/ui";
import { requestApi } from "@/entities/request";
import { COPY_DONE, COPY_FAILED, copyCompletedText } from "./copy-text";
import { EXPORT_FAILED, bundleExportFileName, exportBundle } from "./export-bundle";

vi.mock("@/shared/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/ui")>()),
  toast: vi.fn(),
}));
vi.mock("@/shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/api")>()),
  downloadFile: vi.fn(),
}));

afterEach(() => {
  vi.mocked(toast).mockClear();
  vi.mocked(downloadFile).mockReset();
  vi.restoreAllMocks();
});

describe("copyCompletedText", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  it("copies the text, confirms and records the audit event", async () => {
    writeText.mockResolvedValue();
    const audit = vi.spyOn(requestApi, "copyEvent").mockResolvedValue(undefined);
    await expect(copyCompletedText({ requestId: "REQ-1", contentKey: "C2", text: "홍길동님" })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("홍길동님");
    expect(audit).toHaveBeenCalledWith("REQ-1", "C2");
    expect(toast).toHaveBeenCalledWith(COPY_DONE);
  });

  it("does not fail the copy when the audit call fails", async () => {
    writeText.mockResolvedValue();
    vi.spyOn(requestApi, "copyEvent").mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(copyCompletedText({ requestId: "REQ-1", contentKey: "C1", text: "x" })).resolves.toBe(true);
    expect(toast).toHaveBeenCalledWith(COPY_DONE);
  });

  it("reports a refused clipboard and records nothing", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const audit = vi.spyOn(requestApi, "copyEvent");
    await expect(copyCompletedText({ requestId: "REQ-1", contentKey: "C1", text: "x" })).resolves.toBe(false);
    expect(audit).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(COPY_FAILED);
  });
});

describe("exportBundle", () => {
  it("downloads the XLSX / ZIP of the bundle with the server file names as fallback", async () => {
    vi.mocked(downloadFile).mockResolvedValue();
    await expect(exportBundle("REQ-2609-088", "xlsx")).resolves.toBe(true);
    expect(downloadFile).toHaveBeenCalledWith("/requests/REQ-2609-088/bundle/export.xlsx", "REQ-2609-088_완료본.xlsx");
    await exportBundle("REQ-2609-088", "zip");
    expect(downloadFile).toHaveBeenLastCalledWith(
      "/requests/REQ-2609-088/bundle/attachments.zip",
      "REQ-2609-088_첨부_완료본.zip",
    );
    expect(bundleExportFileName("REQ-2", "xlsx")).toBe("REQ-2_완료본.xlsx");
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows the server message of a refused export (seed file without original) and keeps the dialog", async () => {
    vi.mocked(downloadFile).mockRejectedValue(
      new ApiError(404, { code: "NOT_FOUND", message: "회원약관.pdf: 시연용 파일의 원본이 없습니다" }),
    );
    await expect(exportBundle("REQ-1", "zip")).resolves.toBe(false);
    expect(toast).toHaveBeenCalledWith("회원약관.pdf: 시연용 파일의 원본이 없습니다");
  });

  it("falls back to a generic message for network errors", async () => {
    vi.mocked(downloadFile).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(exportBundle("REQ-1", "xlsx")).resolves.toBe(false);
    expect(toast).toHaveBeenCalledWith(EXPORT_FAILED);
  });
});
