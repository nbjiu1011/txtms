import type { QueryClient } from "@tanstack/react-query";
import { http, uploadFile, type UploadOptions } from "@/shared/api";
import type {
  BulkCommitRow,
  BulkImportPreview,
  Content,
  ContentSave,
  ContentType,
  FileMeta,
  FileRangePatch,
  RequestCreate,
  RequestDetail,
  RequestInfoPatch,
} from "../model/types";
import { requestKeys } from "./request-queries";

const enc = encodeURIComponent;
const req = (id: string) => `/requests/${enc(id)}`;
const content = (id: string, key: string) => `${req(id)}/contents/${enc(key)}`;

/** Request write endpoints (contract §3.7, §4, §5). Plain async functions; callers own the cache. */
export const requestApi = {
  create: (body: RequestCreate) => http.post<RequestDetail>("/requests", body),
  patchInfo: (id: string, patch: RequestInfoPatch) => http.patch<RequestDetail>(req(id), patch),
  changeType: (id: string, type: ContentType) => http.put<RequestDetail>(`${req(id)}/type`, { type }),
  clone: (id: string) => http.post<RequestDetail>(`${req(id)}/clone`),
  submit: (id: string, rowVersion: number, idempotencyKey: string) =>
    http.post<RequestDetail>(`${req(id)}/submit`, { rowVersion }, { headers: { "Idempotency-Key": idempotencyKey } }),
  cancel: (id: string, rowVersion: number) => http.post<RequestDetail>(`${req(id)}/cancel`, { rowVersion }),

  addContent: (id: string, title?: string) => http.post<Content>(`${req(id)}/contents`, title ? { title } : {}),
  deleteContent: (id: string, key: string) => http.delete<void>(content(id, key)),
  saveContent: (id: string, key: string, body: ContentSave) => http.put<Content>(content(id, key), body),

  uploadFile: (id: string, key: string, file: File, options?: UploadOptions) =>
    uploadFile<FileMeta>(`${content(id, key)}/files`, file, options),
  patchFile: (id: string, key: string, fileId: number, body: FileRangePatch) =>
    http.patch<FileMeta>(`${content(id, key)}/files/${fileId}`, body),
  deleteFile: (id: string, key: string, fileId: number) => http.delete<void>(`${content(id, key)}/files/${fileId}`),
  uploadImage: (id: string, key: string, file: File, options?: UploadOptions) =>
    uploadFile<{ imageKey: string }>(`${content(id, key)}/images`, file, options),

  bulkPreview: (id: string, file: File) => uploadFile<BulkImportPreview>(`${req(id)}/bulk-import/preview`, file),
  bulkCommit: (id: string, rows: BulkCommitRow[]) =>
    http.post<RequestDetail>(`${req(id)}/bulk-import/commit`, { rows }),
};

/** Binary paths of the write milestone (fetched with the bearer token). */
export const requestBinaryPaths = {
  bulkTemplate: (type: ContentType) => `/content-types/${type}/bulk-template`,
  image: (id: string, imageKey: string) => `${req(id)}/images/${enc(imageKey)}`,
};

/** Header of the demo-only scan outcome control (actual antivirus is not wired yet). */
export const DEMO_SCAN_HEADER = "X-Demo-Scan-Outcome";

/* ---------- cache helpers ---------- */

/** Stores a fresh detail returned by a write call. */
export function storeRequestDetail(client: QueryClient, detail: RequestDetail): void {
  client.setQueryData(requestKeys.detail(detail.id), detail);
}

/** Replaces (or appends) one content of a cached detail. */
export function storeContent(client: QueryClient, id: string, next: Content): void {
  client.setQueryData<RequestDetail>(requestKeys.detail(id), (old) => {
    if (!old) return old;
    const exists = old.contents.some((c) => c.key === next.key);
    const contents = exists ? old.contents.map((c) => (c.key === next.key ? next : c)) : [...old.contents, next];
    return { ...old, contents, contentCount: contents.length };
  });
}

/** Removes one content of a cached detail. */
export function removeContent(client: QueryClient, id: string, key: string): void {
  client.setQueryData<RequestDetail>(requestKeys.detail(id), (old) => {
    if (!old) return old;
    const contents = old.contents.filter((c) => c.key !== key);
    return { ...old, contents, contentCount: contents.length };
  });
}

/** Applies `update` to the files of one content of a cached detail. */
export function updateContentFiles(
  client: QueryClient,
  id: string,
  key: string,
  update: (files: FileMeta[]) => FileMeta[],
): void {
  client.setQueryData<RequestDetail>(requestKeys.detail(id), (old) => {
    if (!old) return old;
    return { ...old, contents: old.contents.map((c) => (c.key === key ? { ...c, files: update(c.files) } : c)) };
  });
}

/** Lists, dashboards and history that show request rows become stale after a write. */
export function invalidateRequestViews(client: QueryClient, id?: string): void {
  void client.invalidateQueries({ queryKey: ["requests", "list"] });
  void client.invalidateQueries({ queryKey: ["dashboard"] });
  if (id) void client.invalidateQueries({ queryKey: requestKeys.history(id) });
}
