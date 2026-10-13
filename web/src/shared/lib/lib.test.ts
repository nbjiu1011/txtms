import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/requests/REQ-1")).toBe("/requests/REQ-1");
  });
  it("rejects external, protocol-relative and auth paths", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/reset/abc")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("format", () => {
  it("formats in KST like the reference", () => {
    expect(formatDateTime("2026-10-07T05:03:00Z")).toBe("10/7 14:03");
    expect(formatDateTime("2026-10-06T15:30:00Z")).toBe("10/7 00:30");
    expect(formatDate("2026-10-10")).toBe("10월 10일");
    expect(formatDate(null)).toBe("-");
  });
});

