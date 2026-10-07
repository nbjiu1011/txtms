import { describe, expect, it } from "vitest";
import { formatVolume } from "./volume";

describe("formatVolume", () => {
  it("joins characters and per-unit file ranges", () => {
    expect(formatVolume({ chars: 1240, files: [{ unit: "PAGE", amount: 6 }, { unit: "ROW", amount: 30 }] })).toBe(
      "1,240자, 페이지 6, 행 30",
    );
  });
  it("omits zero characters and is empty without volume", () => {
    expect(formatVolume({ chars: 0, files: [{ unit: "SLIDE", amount: 3 }] })).toBe("슬라이드 3");
    expect(formatVolume({ chars: 0, files: [] })).toBe("");
  });
});
