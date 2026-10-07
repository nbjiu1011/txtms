import { describe, expect, it } from "vitest";
import { computePopoverPosition } from "@/shared/ui";
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

describe("computePopoverPosition", () => {
  const rect = (right: number, bottom: number) => ({ right, bottom }) as DOMRect;
  it("aligns the right edge to the anchor, 6px below", () => {
    expect(computePopoverPosition(rect(1000, 40), 380, 1440)).toEqual({ x: 620, y: 46 });
  });
  it("clamps 8px inside the viewport", () => {
    expect(computePopoverPosition(rect(100, 40), 380, 1440).x).toBe(8);
    expect(computePopoverPosition(rect(1438, 40), 300, 1440).x).toBe(1132);
  });
});
