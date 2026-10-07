import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import type { AlimtalkPayload, Content, ContentLock, FileMeta, RevisionSave } from "@/entities/request";
import { request101U2 } from "@fixtures/api-snapshot";
import { LOCK_EXPIRED_MESSAGE, LOCK_REFRESH_MS, RevisionSession, revisionFiles, type RevisionSessionApi } from "./revision-session";

const FILE: FileMeta = {
  id: 31, name: "약관.pdf", ext: "pdf", unit: "PAGE", sizeBytes: 10, totalAmount: 14, reviewAmount: 6,
  rangeNote: "1~6쪽", version: 1, scanStatus: "SAFE", versions: [],
};
const C1: Content = { ...request101U2.contents[0], key: "C1", version: 2, lock: null };
const payload = (body: string): AlimtalkPayload => ({ ...(C1.payload as AlimtalkPayload), body });
const lock = (at = "2026-10-07T05:00:00Z"): ContentLock => ({ userId: 2, lockedAt: at, expiresAt: "2026-10-07T05:30:00Z" });
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(api: Partial<RevisionSessionApi> = {}) {
  let now = 1_000_000;
  const full: RevisionSessionApi = {
    lock: vi.fn(async () => lock()),
    release: vi.fn(async () => undefined),
    save: vi.fn(async (_key: string, body: RevisionSave) => ({ ...C1, version: body.baseVersion + 1, payload: body.payload })),
    ...api,
  };
  const dirty = vi.fn();
  const denied = vi.fn();
  const session = new RevisionSession({ api: full, onDirty: dirty, onLockDenied: denied, now: () => now });
  return { session, api: full, dirty, denied, advance: (ms: number) => (now += ms), now: () => now };
}

describe("RevisionSession — buffer and edit lock", () => {
  it("the first edit opens a buffer from the current version and takes the lock", async () => {
    const { session, api, dirty } = setup();
    session.setPayload(C1, payload("수정 1"));
    expect(session.buffer("C1")).toMatchObject({ base: 2, lock: { status: "acquiring" } });
    expect(session.content(C1).payload).toMatchObject({ body: "수정 1" });
    expect(dirty).toHaveBeenLastCalledWith(true);
    await flush();
    expect(api.lock).toHaveBeenCalledTimes(1);
    expect(session.buffer("C1")?.lock.status).toBe("held");
  });

  it("refreshes the lock while typing at most once a minute (keep-alive)", async () => {
    const { session, api, advance } = setup();
    session.setPayload(C1, payload("a"));
    await flush();
    session.setPayload(C1, payload("ab"));
    advance(LOCK_REFRESH_MS - 1);
    session.setPayload(C1, payload("abc"));
    await flush();
    expect(api.lock).toHaveBeenCalledTimes(1);
    advance(2);
    session.setPayload(C1, payload("abcd"));
    await flush();
    expect(api.lock).toHaveBeenCalledTimes(2);
  });

  it("drops the buffer when another user holds the lock (LOCKED_BY_OTHER)", async () => {
    const error = new ApiError(409, { code: "LOCKED_BY_OTHER", message: "한가을님이 이 문안을 편집 중입니다." });
    const { session, denied, dirty } = setup({ lock: vi.fn(async () => Promise.reject(error)) });
    session.setPayload(C1, payload("x"));
    await flush();
    expect(session.has("C1")).toBe(false);
    expect(denied).toHaveBeenCalledWith("C1", error);
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it("keeps typing through a network failure and retries the lock before saving", async () => {
    const lockCall = vi
      .fn<RevisionSessionApi["lock"]>()
      .mockRejectedValueOnce(new ApiError(0, { code: "NETWORK_ERROR", message: "offline" }))
      .mockResolvedValue(lock());
    const { session, api } = setup({ lock: lockCall });
    session.setPayload(C1, payload("x"));
    await flush();
    expect(session.buffer("C1")?.lock.status).toBe("retry");
    const outcome = await session.save(C1);
    expect(lockCall).toHaveBeenCalledTimes(2);
    expect(outcome.kind).toBe("saved");
    expect(api.save).toHaveBeenCalled();
  });

  it("수정본 저장 sends baseVersion + payload, drops the buffer and reports a new version", async () => {
    const { session, api, dirty } = setup();
    session.setPayload(C1, payload("수정"));
    const outcome = await session.save(C1);
    expect(api.save).toHaveBeenCalledWith("C1", { baseVersion: 2, payload: payload("수정") });
    expect(outcome).toMatchObject({ kind: "saved", changed: true, content: { version: 3 } });
    expect(session.has("C1")).toBe(false);
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it("an unchanged save keeps the version (no new version)", async () => {
    const { session } = setup({ save: vi.fn(async () => C1) });
    session.setPayload(C1, C1.payload);
    expect(await session.save(C1)).toMatchObject({ kind: "saved", changed: false });
  });

  it("VERSION_CONFLICT keeps the buffer and reports the conflict", async () => {
    const message = "v2을 기준으로 수정했지만 지금 최신 버전은 v3입니다. 덮어쓰지 않도록 저장을 막았습니다.";
    const { session } = setup({ save: vi.fn(async () => Promise.reject(new ApiError(409, { code: "VERSION_CONFLICT", message }))) });
    session.setPayload(C1, payload("stale"));
    expect(await session.save(C1)).toEqual({ kind: "conflict", base: 2, message });
    expect(session.has("C1")).toBe(true);
  });

  it("an expired lock on save marks the buffer lost; later saves are refused locally", async () => {
    const save = vi.fn(async () => Promise.reject(new ApiError(409, { code: "LOCKED_BY_OTHER", message: LOCK_EXPIRED_MESSAGE })));
    const { session } = setup({ save });
    session.setPayload(C1, payload("late"));
    expect(await session.save(C1)).toEqual({ kind: "lockLost", message: LOCK_EXPIRED_MESSAGE });
    expect(session.buffer("C1")?.lock.status).toBe("lost");
    expect(await session.save(C1)).toEqual({ kind: "lockLost", message: LOCK_EXPIRED_MESSAGE });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a server copy without my lock (force release) marks the buffer lost; a stale copy does not", async () => {
    const { session, now, advance } = setup();
    session.setPayload(C1, payload("x"));
    await flush();
    session.syncServer([{ ...C1, lock: null }], 2, now() + 1, true);
    expect(session.buffer("C1")?.lock.status).toBe("held");
    advance(10_000);
    session.syncServer([{ ...C1, lock: lock() }], 2, now(), true);
    expect(session.buffer("C1")?.lock.status).toBe("held");
    session.syncServer([{ ...C1, lock: { ...lock(), userId: 3 } }], 2, now(), true);
    expect(session.buffer("C1")?.lock.status).toBe("lost");
  });

  it("losing the edit permission (e.g. 확인 요청 sent) marks buffers lost", async () => {
    const { session, now } = setup();
    session.setPayload(C1, payload("x"));
    await flush();
    session.syncServer([{ ...C1, lock: null }], 2, now(), false);
    expect(session.buffer("C1")?.lock.status).toBe("lost");
  });

  it("변경 취소 drops the buffer and releases my lock", async () => {
    const { session, api, dirty } = setup();
    session.setPayload(C1, payload("x"));
    await session.discard("C1");
    expect(session.has("C1")).toBe(false);
    expect(api.release).toHaveBeenCalledWith("C1");
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it("closing the tab releases every held lock (keepalive on unload)", async () => {
    const { session, api } = setup();
    session.setPayload(C1, payload("x"));
    session.setPayload({ ...C1, key: "C2" }, payload("y"));
    await flush();
    session.releaseAll(true);
    expect(session.hasAny()).toBe(false);
    expect(api.release).toHaveBeenCalledWith("C1", true);
    expect(api.release).toHaveBeenCalledWith("C2", true);
  });

  it("amount edits are sent as `files` with every current attachment", async () => {
    const withFiles: Content = { ...C1, files: [FILE, { ...FILE, id: 32, totalAmount: null, reviewAmount: null, rangeNote: null }] };
    const { session, api } = setup();
    session.setFileRange(withFiles, FILE, { totalAmount: "14", reviewAmount: "8", rangeNote: "1~8쪽" });
    await session.save(withFiles);
    expect(api.save).toHaveBeenCalledWith("C1", {
      baseVersion: 2,
      payload: C1.payload,
      files: [
        { fileId: 31, totalAmount: 14, reviewAmount: 8, rangeNote: "1~8쪽" },
        { fileId: 32, totalAmount: null, reviewAmount: null, rangeNote: null },
      ],
    });
  });

  it("invalid amounts block the save", async () => {
    const { session, api } = setup();
    const withFile: Content = { ...C1, files: [FILE] };
    session.setFileRange(withFile, FILE, { totalAmount: "abc", reviewAmount: "1", rangeNote: "" });
    expect((await session.save(withFile)).kind).toBe("invalid");
    expect(api.save).not.toHaveBeenCalled();
  });

  it("begin() opens a buffer for a file revision upload and resolves with the lock result", async () => {
    const { session } = setup();
    expect(await session.begin(C1)).toBe(true);
    expect(session.content(C1)).toEqual(C1);
    expect(session.has("C1")).toBe(true);
  });
});

describe("revisionFiles", () => {
  it("is undefined without amount edits", () => {
    expect(revisionFiles([FILE], new Map())).toBeUndefined();
  });
});
