import type { Content, ContentPayload, FileMeta, RequestDetail } from "@/entities/request";
import { AUTOSAVE_INTERVAL_MS, createAutosaver, type AutosaveSnapshot, type Autosaver } from "./autosave";
import {
  ContentSaveError,
  isRetriableSaveError,
  type DraftSessionDeps,
  type InfoKey,
} from "./draft-session-types";
import { saveEntries, type ContentEntry, type DraftEntries } from "./draft-save";
import { parseFileRange, type FileRangeDraft } from "./file-range";

export { ContentSaveError, INFO_KEYS, isRetriableSaveError } from "./draft-session-types";
export type { DraftSessionApi, DraftSessionDeps, InfoKey } from "./draft-session-types";


/**
 * Local edits of one draft request tab on top of the server copy: request info fields, content
 * titles/payloads and attachment ranges. Edits are autosaved (debounced, retried, every 30s while
 * something is pending); the server copy stays the source of truth and is refreshed from each
 * response. An entry is dropped once saved unless it was edited again meanwhile.
 */
export class DraftSession {
  private readonly deps: DraftSessionDeps;
  private readonly saver: Autosaver;
  private readonly entries: DraftEntries = {
    info: new Map(),
    contents: new Map(),
    files: new Map(),
    savedInfo: new Map(),
    savedContents: new Map(),
  };
  private get info() {
    return this.entries.info;
  }
  private get contents() {
    return this.entries.contents;
  }
  private get files() {
    return this.entries.files;
  }
  private readonly listeners = new Set<() => void>();
  private rev = 0;
  private version = 0;
  private interval: unknown = null;
  private lastDirty = false;
  private disposed = false;
  /** Last save failed for a reason retrying cannot fix: wait for the next edit or a manual save. */
  private blocked = false;
  private state: AutosaveSnapshot = { status: "idle", savedAt: null };

  constructor(deps: DraftSessionDeps) {
    this.deps = deps;
    this.saver = createAutosaver({
      save: () => this.save(),
      hasPending: () => this.hasPending(),
      onChange: (s) => {
        this.state = s;
        this.emit();
      },
      onError: (error) => {
        this.blocked = !isRetriableSaveError(error);
        deps.onError(error instanceof ContentSaveError ? error.error : error, contentKeyOf(error));
      },
      retriable: isRetriableSaveError,
      timers: deps.timers,
      now: deps.now,
    });
  }

  /* ---------- store protocol (useSyncExternalStore) ---------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    for (const l of this.listeners) l();
    const dirty = this.hasUnsaved();
    if (dirty !== this.lastDirty) {
      this.lastDirty = dirty;
      this.deps.onDirty(dirty);
    }
  }

  get saveState(): AutosaveSnapshot {
    return this.state;
  }

  /* ---------- reads ---------- */

  infoValue(key: InfoKey, server: RequestDetail): string {
    const entry = this.info.get(key);
    if (entry) return entry.value;
    const saved = this.entries.savedInfo.get(key);
    if (saved && server.rowVersion < saved.rowVersion) return saved.value;
    return (server[key] as string | null | undefined) ?? "";
  }

  /** The content as the editor shows it (local title/payload over the server copy). */
  content(server: Content): Content {
    const entry = this.contents.get(server.key);
    if (!entry) {
      const saved = this.entries.savedContents.get(server.key);
      return saved && isOlder(server.savedAt, saved.savedAt)
        ? { ...server, title: saved.title, payload: saved.payload }
        : server;
    }
    return { ...server, title: entry.title ?? server.title, payload: entry.payload ?? server.payload };
  }

  fileRange(file: FileMeta): FileRangeDraft {
    const entry = this.files.get(file.id);
    if (entry) return entry.value;
    return {
      totalAmount: file.totalAmount === null ? "" : String(file.totalAmount),
      reviewAmount: file.reviewAmount === null ? "" : String(file.reviewAmount),
      rangeNote: file.rangeNote ?? "",
    };
  }

  /** Something can be sent now (invalid file ranges wait for a valid value). */
  hasPending(): boolean {
    if (this.info.size > 0 || this.contents.size > 0) return true;
    for (const f of this.files.values()) if (parseFileRange(f.value).patch) return true;
    return false;
  }

  /** Something typed is not on the server yet (tab dirty marker, close confirmation). */
  hasUnsaved(): boolean {
    return this.info.size > 0 || this.contents.size > 0 || this.files.size > 0 || this.state.status === "saving";
  }

  /* ---------- edits ---------- */

  setInfo(key: InfoKey, value: string) {
    this.info.set(key, { value, rev: ++this.rev });
    this.touch();
  }

  setContentTitle(server: Content, title: string) {
    this.editContent(server, { title });
  }

  setPayload(server: Content, payload: ContentPayload) {
    this.editContent(server, { payload });
  }

  setFileRange(contentKey: string, fileId: number, value: FileRangeDraft) {
    this.files.set(fileId, { contentKey, value, rev: ++this.rev });
    this.touch();
  }

  private editContent(server: Content, patch: Pick<ContentEntry, "title" | "payload">) {
    const prev = this.contents.get(server.key);
    this.contents.set(server.key, {
      title: prev?.title,
      payload: prev?.payload,
      // the server copy passed in may be the one before my last save (see `content`): start from the newer
      base: prev ? prev.base : this.latestSavedAt(server),
      ...patch,
      rev: ++this.rev,
    });
    this.touch();
  }

  private latestSavedAt(server: Content): string | null {
    const saved = this.entries.savedContents.get(server.key);
    return saved && isOlder(server.savedAt, saved.savedAt) ? saved.savedAt : server.savedAt;
  }

  private touch() {
    this.blocked = false;
    this.ensureInterval();
    this.emit();
    this.saver.schedule();
  }

  /** Forgets local edits of one content (deleted, reset by a type change, reloaded after a conflict). */
  discardContent(key: string) {
    this.contents.delete(key);
    this.entries.savedContents.delete(key);
    for (const [id, f] of this.files) if (f.contentKey === key) this.files.delete(id);
    this.emit();
  }

  discardContents() {
    this.contents.clear();
    this.entries.savedContents.clear();
    this.files.clear();
    this.emit();
  }

  discardFile(fileId: number) {
    this.files.delete(fileId);
    this.emit();
  }

  /** Saves now (manual 저장, before submit). Resolves true when nothing is left unsaved. */
  flush(): Promise<boolean> {
    this.blocked = false;
    return this.saver.flush();
  }

  dispose() {
    this.disposed = true;
    this.saver.dispose();
    if (this.interval !== null) clearInterval(this.interval as ReturnType<typeof setInterval>);
    this.interval = null;
  }

  private ensureInterval() {
    if (this.interval !== null || this.disposed) return;
    this.interval = setInterval(() => {
      if (!this.deps.alive()) {
        this.dispose();
        return;
      }
      if (!this.blocked && this.hasPending() && this.state.status !== "saving") void this.saver.flush();
    }, AUTOSAVE_INTERVAL_MS);
  }

  private save(): Promise<string | null> {
    if (!this.deps.alive()) {
      this.dispose();
      return Promise.resolve(null);
    }
    return saveEntries(this.entries, this.deps, () => this.emit());
  }
}

/** `server` (ISO time or null) is older than `saved`: the screen still has the copy before that save. */
function isOlder(server: string | null, saved: string | null): boolean {
  if (saved === null) return false;
  return server === null || Date.parse(server) < Date.parse(saved);
}

function contentKeyOf(error: unknown): string | null {
  return error instanceof ContentSaveError ? error.contentKey : null;
}
