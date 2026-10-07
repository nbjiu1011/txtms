import { isApiError } from "@/shared/api";
import type { Content, ContentLockGrant, ContentPayload, FileMeta, RevisionFileAmount, RevisionSave } from "@/entities/request";
import { parseFileRange, readFileRange, type FileRangeDraft } from "./file-range";

/** Keep-alive: an edit refreshes the server lock when the last refresh is at least this old. */
export const LOCK_REFRESH_MS = 60_000;
/** A server copy fetched this long after the lock was taken must show it (else the lock was lost). */
const LOCK_SYNC_GRACE_MS = 5_000;

export const LOCK_EXPIRED_MESSAGE = "편집 잠금이 만료되었습니다. 최신 버전을 다시 불러오세요";

/**
 * Lock of one buffer: being taken, held (refreshed while typing) or lost (released by a lead or
 * admin, expired, or the request moved on — the buffer can no longer be saved).
 */
export type BufferLock =
  | { status: "acquiring" }
  | { status: "held"; expiresAt: string; refreshedAt: number }
  /** The lock call failed for a network reason: the next edit or the save tries again. */
  | { status: "retry" }
  | { status: "lost" };

/** Local edits of one content since the first edit (reference `tab.st.buf[cid]`). */
export interface RevisionBuffer {
  /** Content version the edit started from (`baseVersion`). */
  base: number;
  payload: ContentPayload;
  /** Attachment amounts as typed (only edited files). */
  files: Map<number, FileRangeDraft>;
  lock: BufferLock;
}

export interface RevisionSessionApi {
  lock(key: string): Promise<ContentLockGrant>;
  release(key: string, keepalive?: boolean): Promise<void>;
  save(key: string, body: RevisionSave): Promise<Content>;
}

export interface RevisionSessionDeps {
  api: RevisionSessionApi;
  /** Some buffer exists (tab dirty marker, close confirmation). */
  onDirty(dirty: boolean): void;
  /** The first edit could not take the lock (another editor, or editing is no longer allowed). */
  onLockDenied(key: string, error: unknown): void;
  /**
   * The lock answer shows a newer version than the one the buffer started from (someone saved after this
   * screen was loaded): the buffer was dropped and the lock released — load the latest version first.
   */
  onStaleBase(key: string, version: number): void;
  now?: () => number;
}

export type SaveOutcome =
  | { kind: "saved"; content: Content; changed: boolean }
  /** Someone saved a newer version first (`VERSION_CONFLICT`). */
  | { kind: "conflict"; base: number; message: string }
  /** The lock is gone; the buffer cannot be saved. */
  | { kind: "lockLost"; message: string }
  /** Attachment amounts are not valid numbers yet. */
  | { kind: "invalid"; message: string }
  | { kind: "error"; error: unknown }
  | { kind: "none" };

/**
 * Review-time editing of one work tab (검수 중: assigned reviewers, 확인 요청: the requester). The first
 * edit of a content opens a buffer and takes the server edit lock; typing refreshes the lock at most
 * once a minute; 수정본 저장 sends the buffer as a revision (`baseVersion` guards against overwriting a
 * newer version) and the server releases the lock; 변경 취소 drops the buffer and releases it.
 * Framework free (React subscribes through `subscribe`/`getVersion`).
 */
export class RevisionSession {
  private readonly deps: RevisionSessionDeps;
  private readonly buffers = new Map<string, RevisionBuffer>();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private lastDirty = false;

  constructor(deps: RevisionSessionDeps) {
    this.deps = deps;
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  /* ---------- store protocol ---------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    for (const l of this.listeners) l();
    const dirty = this.buffers.size > 0;
    if (dirty !== this.lastDirty) {
      this.lastDirty = dirty;
      this.deps.onDirty(dirty);
    }
  }

  /* ---------- reads ---------- */

  buffer(key: string): RevisionBuffer | undefined {
    return this.buffers.get(key);
  }

  has(key: string): boolean {
    return this.buffers.has(key);
  }

  hasAny(): boolean {
    return this.buffers.size > 0;
  }

  keys(): string[] {
    return [...this.buffers.keys()];
  }

  /** The content as the editor shows it (buffered payload over the server copy). */
  content(server: Content): Content {
    const buffer = this.buffers.get(server.key);
    return buffer ? { ...server, payload: buffer.payload } : server;
  }

  fileRange(contentKey: string, file: FileMeta): FileRangeDraft {
    return this.buffers.get(contentKey)?.files.get(file.id) ?? readFileRange(file);
  }

  /* ---------- edits ---------- */

  setPayload(server: Content, payload: ContentPayload) {
    this.edit(server, (b) => {
      b.payload = payload;
    });
  }

  setFileRange(server: Content, file: FileMeta, value: FileRangeDraft) {
    this.edit(server, (b) => {
      b.files.set(file.id, value);
    });
  }

  /**
   * Opens the buffer (taking the lock) without changing anything — used before uploading a file
   * revision, which changes the attachment and therefore needs a 수정본 저장 afterwards.
   * Resolves false when the lock could not be taken.
   */
  begin(server: Content): Promise<boolean> {
    this.edit(server, () => undefined);
    return this.pending.get(server.key) ?? Promise.resolve(this.buffers.get(server.key)?.lock.status === "held");
  }

  private edit(server: Content, mutate: (buffer: RevisionBuffer) => void) {
    let buffer = this.buffers.get(server.key);
    if (!buffer) {
      buffer = { base: server.version, payload: server.payload, files: new Map(), lock: { status: "acquiring" } };
      this.buffers.set(server.key, buffer);
      mutate(buffer);
      this.emit();
      this.acquire(server.key);
      return;
    }
    mutate(buffer);
    this.emit();
    const lock = buffer.lock;
    if (lock.status === "retry" || (lock.status === "held" && this.now() - lock.refreshedAt >= LOCK_REFRESH_MS)) {
      this.acquire(server.key);
    }
  }

  /** Takes (first edit, retry) or refreshes (keep-alive) the lock of a buffer. */
  private acquire(key: string) {
    if (this.pending.has(key)) return;
    const startedAt = this.now();
    const run = this.deps.api
      .lock(key)
      .then((lock) => {
        const buffer = this.buffers.get(key);
        if (!buffer || buffer.lock.status === "lost") return false;
        if (buffer.lock.status !== "held" && lock.version !== buffer.base) {
          // contract §14.2: the screen copy is outdated — start again from the latest version
          this.buffers.delete(key);
          this.emit();
          void this.deps.api.release(key).catch(() => undefined);
          this.deps.onStaleBase(key, lock.version);
          return false;
        }
        buffer.lock = { status: "held", expiresAt: lock.expiresAt, refreshedAt: startedAt };
        this.emit();
        return true;
      })
      .catch((error: unknown) => {
        const buffer = this.buffers.get(key);
        if (!buffer) return false;
        if (buffer.lock.status !== "held" && isDenied(error)) {
          this.buffers.delete(key);
          this.emit();
          this.deps.onLockDenied(key, error);
          return false;
        }
        if (isDenied(error)) {
          buffer.lock = { status: "lost" };
          this.emit();
          return false;
        }
        // Network trouble: keep typing; the next edit or the save tries again. A held lock stays
        // held until it expires on the server.
        if (buffer.lock.status !== "held") buffer.lock = { status: "retry" };
        this.emit();
        return false;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, run);
  }

  /**
   * Reconciles buffers with a fresh server copy: a buffer whose lock is not shown as mine in a copy
   * fetched after the lock was taken has lost it (force release, auto expiry, assignment change).
   */
  syncServer(contents: readonly Content[], meId: number, fetchedAt: number, editable: boolean) {
    let changed = false;
    for (const [key, buffer] of this.buffers) {
      if (buffer.lock.status !== "held") continue;
      const server = contents.find((c) => c.key === key);
      const mine = server?.lock?.userId === meId;
      if (!editable || (!mine && fetchedAt > buffer.lock.refreshedAt + LOCK_SYNC_GRACE_MS)) {
        buffer.lock = { status: "lost" };
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /* ---------- save / discard ---------- */

  /** Sends the buffer of `server` as a revision (수정본 저장). */
  async save(server: Content): Promise<SaveOutcome> {
    const key = server.key;
    if (this.buffers.get(key)?.lock.status === "retry") this.acquire(key);
    const inflight = this.pending.get(key);
    if (inflight) await inflight;
    const buffer = this.buffers.get(key);
    if (!buffer) return { kind: "none" };
    if (buffer.lock.status === "retry") return { kind: "error", error: new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요") };
    if (buffer.lock.status === "lost") return { kind: "lockLost", message: LOCK_EXPIRED_MESSAGE };
    const files = revisionFiles(server.files, buffer.files);
    if (files === "invalid") return { kind: "invalid", message: "첨부파일 분량을 확인하세요" };
    const body: RevisionSave = { baseVersion: buffer.base, payload: buffer.payload };
    if (files) body.files = files;
    try {
      const content = await this.deps.api.save(key, body);
      if (this.buffers.get(key) === buffer) this.buffers.delete(key);
      this.emit();
      return { kind: "saved", content, changed: content.version !== buffer.base };
    } catch (error) {
      if (isApiError(error) && error.code === "VERSION_CONFLICT") {
        return { kind: "conflict", base: buffer.base, message: error.message };
      }
      if (isApiError(error) && error.code === "LOCKED_BY_OTHER") {
        buffer.lock = { status: "lost" };
        this.emit();
        return { kind: "lockLost", message: error.message || LOCK_EXPIRED_MESSAGE };
      }
      return { kind: "error", error };
    }
  }

  /** 변경 취소: drops the buffer and releases my lock (a failed release just expires later). */
  async discard(key: string): Promise<void> {
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    this.buffers.delete(key);
    this.emit();
    const inflight = this.pending.get(key);
    if (inflight) await inflight.catch(() => false);
    if (buffer.lock.status === "lost") return;
    await this.deps.api.release(key).catch(() => undefined);
  }

  /** Tab closed / page unloading: drops every buffer and releases the locks. */
  releaseAll(keepalive = false) {
    const keys = [...this.buffers.entries()].filter(([, b]) => b.lock.status !== "lost").map(([k]) => k);
    this.buffers.clear();
    this.emit();
    for (const key of keys) void this.deps.api.release(key, keepalive).catch(() => undefined);
  }
}

/** The lock request was refused for a business reason (not worth retrying). */
function isDenied(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

/**
 * `files` of a revision: every current attachment with its (edited or current) amounts when some
 * amount was edited, undefined when none was, "invalid" when an edited value cannot be sent.
 */
export function revisionFiles(
  files: readonly FileMeta[],
  edited: ReadonlyMap<number, FileRangeDraft>,
): RevisionFileAmount[] | undefined | "invalid" {
  if (![...edited.keys()].some((id) => files.some((f) => f.id === id))) return undefined;
  const out: RevisionFileAmount[] = [];
  for (const file of files) {
    const draft = edited.get(file.id);
    if (!draft) {
      out.push({ fileId: file.id, totalAmount: file.totalAmount, reviewAmount: file.reviewAmount, rangeNote: file.rangeNote });
      continue;
    }
    const { patch } = parseFileRange(draft);
    if (!patch) return "invalid";
    out.push({ fileId: file.id, ...patch, rangeNote: patch.rangeNote || null });
  }
  return out;
}
