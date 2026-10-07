import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import type { Content, FileMeta, RequestDetail } from "@/entities/request";
import { request102U1 } from "@fixtures/api-snapshot";
import { DraftSession, type DraftSessionApi } from "./draft-session";
import { parseFileRange } from "./file-range";

const FILE: FileMeta = {
  id: 31, name: "약관.pdf", ext: "pdf", unit: "PAGE", sizeBytes: 10, totalAmount: null, reviewAmount: null,
  rangeNote: null, version: 1, scanStatus: "SAFE", versions: [],
};

function draft(): RequestDetail {
  return {
    ...request102U1,
    id: "REQ-T",
    status: "DRAFT",
    contents: [{ ...request102U1.contents[0], key: "C1", savedAt: "2026-10-07T01:00:00Z", files: [FILE] }],
  };
}

function setup(api: Partial<DraftSessionApi> = {}) {
  let server = draft();
  const calls: string[] = [];
  const full: DraftSessionApi = {
    patchInfo: vi.fn(async (patch) => {
      calls.push(`patch:${JSON.stringify(patch)}`);
      server = { ...server, ...patch } as RequestDetail;
      return server;
    }),
    saveContent: vi.fn(async (key, body) => {
      calls.push(`put:${key}:${body.expectedSavedAt}`);
      return { ...server.contents[0], title: body.title, payload: body.payload, savedAt: "2026-10-07T02:00:00Z" } as Content;
    }),
    patchFile: vi.fn(async (_key, fileId, body) => {
      calls.push(`file:${fileId}:${JSON.stringify(body)}`);
      return { ...FILE, ...body };
    }),
    ...api,
  };
  const dirty = vi.fn();
  const onError = vi.fn();
  const session = new DraftSession({
    api: full,
    server: () => server,
    onDetail: (d) => (server = d),
    onContent: (c) => (server = { ...server, contents: server.contents.map((x) => (x.key === c.key ? c : x)) }),
    onFile: vi.fn(),
    alive: () => true,
    onDirty: dirty,
    onError,
    now: () => "2026-10-07T03:00:00Z",
  });
  return { session, api: full, calls, dirty, onError, server: () => server };
}

describe("DraftSession", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows local values over the server copy until saved", async () => {
    const t = setup();
    t.session.setInfo("title", "새 제목");
    expect(t.session.infoValue("title", t.server())).toBe("새 제목");
    expect(t.dirty).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(t.calls).toEqual(['patch:{"title":"새 제목"}']);
    expect(t.session.saveState.status).toBe("saved");
    expect(t.dirty).toHaveBeenLastCalledWith(false);
  });

  it("sends an emptied hope due date and campaign as null", async () => {
    const t = setup();
    t.session.setInfo("hopeDueDate", "");
    t.session.setInfo("campaign", " ");
    await vi.advanceTimersByTimeAsync(700);
    expect(t.calls).toEqual(['patch:{"hopeDueDate":null,"campaign":null}']);
  });

  it("saves a content with the savedAt the edit started from", async () => {
    const t = setup();
    const c = t.server().contents[0];
    t.session.setContentTitle(c, "제목 A");
    t.session.setPayload(c, { ...c.payload, body: "본문" } as Content["payload"]);
    await vi.advanceTimersByTimeAsync(700);
    expect(t.calls).toEqual(["put:C1:2026-10-07T01:00:00Z"]);
    expect(t.session.content(t.server().contents[0]).title).toBe("제목 A");
    expect(t.session.saveState.savedAt).toBe("2026-10-07T02:00:00Z");
  });

  it("reports a version conflict once without retrying", async () => {
    const conflict = new ApiError(409, { code: "VERSION_CONFLICT", message: "다른 탭에서 저장" });
    const t = setup({ saveContent: vi.fn(async () => Promise.reject(conflict)) });
    t.session.setContentTitle(t.server().contents[0], "x");
    await vi.advanceTimersByTimeAsync(700 + 5000);
    expect(t.api.saveContent).toHaveBeenCalledTimes(1);
    expect(t.onError).toHaveBeenCalledWith(conflict, "C1");
    expect(t.session.saveState.status).toBe("fail");
    // The 30s interval does not hammer a blocked save.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(t.api.saveContent).toHaveBeenCalledTimes(1);
    t.session.discardContent("C1");
    expect(t.session.hasUnsaved()).toBe(false);
  });

  it("keeps an invalid file range local and saves valid ones", async () => {
    const t = setup();
    t.session.setFileRange("C1", 31, { totalAmount: "1.5", reviewAmount: "", rangeNote: "" });
    await vi.advanceTimersByTimeAsync(700);
    expect(t.api.patchFile).not.toHaveBeenCalled();
    expect(t.session.hasUnsaved()).toBe(true);
    t.session.setFileRange("C1", 31, { totalAmount: "14", reviewAmount: "6", rangeNote: "1~6쪽 " });
    await vi.advanceTimersByTimeAsync(700);
    expect(t.calls).toEqual(['file:31:{"totalAmount":14,"reviewAmount":6,"rangeNote":"1~6쪽"}']);
    expect(t.session.hasUnsaved()).toBe(false);
  });
});

describe("parseFileRange", () => {
  it("accepts empty amounts as not entered", () => {
    expect(parseFileRange({ totalAmount: "", reviewAmount: "", rangeNote: "" })).toEqual({
      patch: { totalAmount: null, reviewAmount: null, rangeNote: "" },
      errors: {},
    });
  });

  it("rejects non-integers and long notes", () => {
    const r = parseFileRange({ totalAmount: "-1", reviewAmount: "2.5", rangeNote: "x".repeat(201) });
    expect(r.patch).toBeNull();
    expect(r.errors.totalAmount).toBe("0 이상의 정수를 입력하세요");
    expect(r.errors.reviewAmount).toBe("0 이상의 정수를 입력하세요");
    expect(r.errors.rangeNote).toBe("범위 설명은 최대 200자입니다");
  });

  it("flags a review range outside 1..total but still saves it", () => {
    const r = parseFileRange({ totalAmount: "5", reviewAmount: "7", rangeNote: "" });
    expect(r.patch).toEqual({ totalAmount: 5, reviewAmount: 7, rangeNote: "" });
    expect(r.errors.reviewAmount).toBe("검수 범위는 전체 분량 이내의 양의 정수");
    expect(parseFileRange({ totalAmount: "0", reviewAmount: "0", rangeNote: "" }).errors.totalAmount).toBeTruthy();
    expect(parseFileRange({ totalAmount: "5", reviewAmount: "5", rangeNote: "" }).errors).toEqual({});
  });
});
