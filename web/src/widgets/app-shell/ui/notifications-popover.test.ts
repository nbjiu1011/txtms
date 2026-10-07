import { describe, expect, it } from "vitest";
import type { Notification } from "@/entities/notification";
import { notificationMeta } from "./notifications-popover";

const n = (patch: Partial<Notification>): Notification => ({
  id: 1,
  kind: "ASK",
  requestId: "REQ-1",
  text: "",
  createdAt: "2026-10-07T05:00:00Z",
  read: false,
  renotify: false,
  pending: true,
  ...patch,
});

describe("notification meta (reference J:223)", () => {
  it("shows read state, pending work and the reminder mark", () => {
    expect(notificationMeta(n({}))).toBe("10/7 14:00 · 안 읽음 · 업무 미처리");
    expect(notificationMeta(n({ read: true, pending: false, renotify: true }))).toBe(
      "10/7 14:00 · 읽음 · 업무 처리 완료 · 재통지",
    );
  });

  it("a notification without a request is never 처리 완료", () => {
    expect(notificationMeta(n({ requestId: null, pending: false }))).toContain("업무 미처리");
  });
});
