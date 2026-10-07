import { isApiError } from "@/shared/api";

/** Per-file upload progress (reference `tab.st.uploads`). */
export type UploadState = "uploading" | "scanning" | "done" | "blocked" | "failed";

export const UPLOAD_STATE_LABEL: Record<UploadState, string> = {
  uploading: "업로드 중",
  scanning: "파일 검사 중",
  done: "업로드 완료",
  blocked: "안전하지 않은 파일로 등록 차단",
  failed: "검사 실패",
};

export interface UploadItem {
  id: number;
  name: string;
  state: UploadState;
  /** API message of a rejected file. */
  error: string | null;
}

/**
 * A malware verdict blocks the file; every other rejection (format, size, scan failure) fails it.
 * The API sends `FILE_UNSAFE` (`FILE_SCAN_FAILED` for a failed scan); a `FILE_REJECTED` carrying the
 * "위험 파일" message is still read as blocked.
 */
export function classifyUploadError(error: unknown): Pick<UploadItem, "state" | "error"> {
  const message = isApiError(error) ? error.message : error instanceof Error ? error.message : "업로드하지 못했습니다";
  const blocked =
    isApiError(error) &&
    (error.code === "FILE_UNSAFE" || (error.code === "FILE_REJECTED" && message.startsWith("위험 파일")));
  return { state: blocked ? "blocked" : "failed", error: message };
}

export interface UploadQueueDeps<T> {
  /** Uploads one file; `onSent` fires once its bytes are sent (the server then inspects it). */
  upload: (file: File, onSent: () => void) => Promise<T>;
  /** Item created or changed. */
  onItem: (item: UploadItem) => void;
  /** A file was stored. */
  onUploaded: (result: T) => void;
  nextId: () => number;
}

/**
 * Uploads files one request per file. Each result is independent: a rejected file does not stop
 * the others (the reference stopped at the first failure).
 */
export async function uploadAll<T>(files: readonly File[], deps: UploadQueueDeps<T>): Promise<UploadItem[]> {
  const items = files.map((f): UploadItem => ({ id: deps.nextId(), name: f.name, state: "uploading", error: null }));
  items.forEach((item) => deps.onItem(item));
  for (let i = 0; i < files.length; i++) {
    let item = items[i];
    const update = (patch: Partial<UploadItem>) => {
      item = { ...item, ...patch };
      items[i] = item;
      deps.onItem(item);
    };
    try {
      const result = await deps.upload(files[i], () => update({ state: "scanning" }));
      deps.onUploaded(result);
      update({ state: "done" });
    } catch (error) {
      update(classifyUploadError(error));
    }
  }
  return items;
}
