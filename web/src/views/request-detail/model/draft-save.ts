import { isApiError } from "@/shared/api";
import type { Content, ContentPayload, FileMeta, RequestDetail, RequestInfoPatch } from "@/entities/request";
import { ContentSaveError, NULLABLE_INFO, type DraftSessionDeps, type InfoKey } from "./draft-session-types";
import { parseFileRange, type FileRangeDraft } from "./file-range";

export interface Entry<T> {
  value: T;
  rev: number;
}

export interface ContentEntry {
  title?: string;
  payload?: ContentPayload;
  /** `savedAt` of the server copy the edit started from (conflict detection). */
  base: string | null;
  rev: number;
}

export interface FileEntry {
  contentKey: string;
  value: FileRangeDraft;
  rev: number;
}

/** Local edits waiting to be saved. */
export interface DraftEntries {
  info: Map<InfoKey, Entry<string>>;
  contents: Map<string, ContentEntry>;
  files: Map<number, FileEntry>;
}

/**
 * Sends every pending edit (request info PATCH, content PUTs, attachment range PATCHes) and drops
 * the entries that were not edited again meanwhile. Resolves with the last saved time.
 */
export async function saveEntries(entries: DraftEntries, deps: DraftSessionDeps, emit: () => void): Promise<string | null> {
  const now = deps.now ?? (() => new Date().toISOString());
  let savedAt: string | null = null;

  if (entries.info.size > 0) {
    const snapshot = [...entries.info.entries()];
    const patch: Record<string, string | null> = {};
    for (const [key, entry] of snapshot) {
      patch[key] = NULLABLE_INFO.has(key) && entry.value.trim() === "" ? null : entry.value;
    }
    let detail: RequestDetail;
    try {
      detail = await deps.api.patchInfo(patch as RequestInfoPatch);
    } catch (error) {
      throw new ContentSaveError(error, null);
    }
    deps.onDetail(detail);
    for (const [key, entry] of snapshot) if (entries.info.get(key)?.rev === entry.rev) entries.info.delete(key);
    savedAt = now();
    emit();
  }

  for (const [key, entry] of [...entries.contents.entries()]) {
    const server = deps.server()?.contents.find((c) => c.key === key);
    if (!server) {
      entries.contents.delete(key);
      continue;
    }
    let saved: Content;
    try {
      saved = await deps.api.saveContent(key, {
        title: entry.title ?? server.title,
        payload: entry.payload ?? server.payload,
        expectedSavedAt: entry.base,
      });
    } catch (error) {
      throw new ContentSaveError(error, key);
    }
    deps.onContent(saved);
    const current = entries.contents.get(key);
    if (current?.rev === entry.rev) entries.contents.delete(key);
    else if (current) current.base = saved.savedAt;
    savedAt = saved.savedAt ?? now();
    emit();
  }

  for (const [fileId, entry] of [...entries.files.entries()]) {
    const { patch } = parseFileRange(entry.value);
    if (!patch) continue;
    let saved: FileMeta;
    try {
      saved = await deps.api.patchFile(entry.contentKey, fileId, patch);
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        entries.files.delete(fileId);
        continue;
      }
      throw new ContentSaveError(error, entry.contentKey);
    }
    deps.onFile(entry.contentKey, saved);
    if (entries.files.get(fileId)?.rev === entry.rev) entries.files.delete(fileId);
    savedAt = now();
    emit();
  }
  return savedAt;
}
