import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { UPLOAD_STATE_LABEL, classifyUploadError, uploadAll, type UploadItem } from "./upload-queue";

const file = (name: string) => new File(["x"], name);

describe("uploadAll", () => {
  it("uploads each file independently and reports per-file states", async () => {
    let n = 0;
    const timeline: string[] = [];
    const uploaded = vi.fn();
    const items = await uploadAll([file("a.pdf"), file("bad.exe"), file("c.png")], {
      nextId: () => ++n,
      upload: async (f, onSent) => {
        onSent();
        if (f.name === "bad.exe") {
          throw new ApiError(400, { code: "FILE_REJECTED", message: "허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG" });
        }
        return f.name;
      },
      onItem: (item: UploadItem) => timeline.push(`${item.name}:${item.state}`),
      onUploaded: uploaded,
    });
    expect(items.map((i) => [i.name, i.state])).toEqual([
      ["a.pdf", "done"],
      ["bad.exe", "failed"],
      ["c.png", "done"],
    ]);
    expect(items[1].error).toBe("허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG");
    expect(uploaded.mock.calls.map((c) => c[0])).toEqual(["a.pdf", "c.png"]);
    expect(timeline.slice(0, 6)).toEqual([
      "a.pdf:uploading",
      "bad.exe:uploading",
      "c.png:uploading",
      "a.pdf:scanning",
      "a.pdf:done",
      "bad.exe:scanning",
    ]);
  });

  it("labels states with the reference wording", () => {
    expect(UPLOAD_STATE_LABEL).toMatchObject({ uploading: "업로드 중", scanning: "파일 검사 중", done: "업로드 완료" });
  });

  it("blocks unsafe files and fails other rejections", () => {
    const unsafe = new ApiError(400, { code: "FILE_REJECTED", message: "위험 파일 검사 결과: 등록할 수 없습니다" });
    const scanFail = new ApiError(400, { code: "FILE_REJECTED", message: "검사 서비스 실패 시연: 등록할 수 없습니다" });
    expect(classifyUploadError(unsafe)).toEqual({ state: "blocked", error: unsafe.message });
    expect(classifyUploadError(scanFail).state).toBe("failed");
    expect(classifyUploadError(new Error("offline")).error).toBe("offline");
  });
});
