import { isApiError } from "@/shared/api";
import type { Content, ContentSave, FileMeta, FileRangePatch, RequestDetail, RequestInfoPatch } from "@/entities/request";
import type { AutosaveTimers } from "./autosave";

/** Request info fields edited on the 요청 정보 tab (autosaved with PATCH). */
export const INFO_KEYS = ["title", "hopeDueDate", "purpose", "target", "background", "campaign"] as const;
export type InfoKey = (typeof INFO_KEYS)[number];

/** Keys whose empty value is sent as null (clears the value). */
export const NULLABLE_INFO: ReadonlySet<InfoKey> = new Set<InfoKey>(["hopeDueDate", "campaign"]);

export interface DraftSessionApi {
  patchInfo(patch: RequestInfoPatch): Promise<RequestDetail>;
  saveContent(key: string, body: ContentSave): Promise<Content>;
  patchFile(key: string, fileId: number, body: FileRangePatch): Promise<FileMeta>;
}

export interface DraftSessionDeps {
  api: DraftSessionApi;
  /** Latest server copy of the request (query cache). */
  server(): RequestDetail | undefined;
  onDetail(detail: RequestDetail): void;
  onContent(content: Content): void;
  onFile(contentKey: string, file: FileMeta): void;
  /** The owning work tab is still open (timers of a closed tab stop and drop their work). */
  alive(): boolean;
  /** Unsaved state changed (tab dirty marker). */
  onDirty(dirty: boolean): void;
  /** Final save failure (after retries). */
  onError(error: unknown, contentKey: string | null): void;
  timers?: AutosaveTimers;
  now?: () => string;
}

/** A save failure tagged with the content it belongs to. */
export class ContentSaveError extends Error {
  constructor(
    readonly error: unknown,
    readonly contentKey: string | null,
  ) {
    super(error instanceof Error ? error.message : "저장하지 못했습니다");
  }
}

/** Network errors, 5xx and 408/429 are worth retrying; business rejections are not. */
export function isRetriableSaveError(error: unknown): boolean {
  const e = error instanceof ContentSaveError ? error.error : error;
  if (!isApiError(e)) return true;
  if (e.status === 0 || e.status === 408 || e.status === 429) return true;
  return e.status >= 500;
}
