import { describe, expect, it } from "vitest";
import { nextArchivePage } from "./archive-queries";

const page = (number: number, totalPages: number) => ({ page: { number, size: 20, totalElements: totalPages * 20, totalPages } });

describe("nextArchivePage (더 보기)", () => {
  it("asks for the following page while pages remain", () => {
    expect(nextArchivePage(page(0, 3))).toBe(1);
    expect(nextArchivePage(page(1, 3))).toBe(2);
  });

  it("stops on the last page and for an empty archive", () => {
    expect(nextArchivePage(page(2, 3))).toBeUndefined();
    expect(nextArchivePage(page(0, 1))).toBeUndefined();
    expect(nextArchivePage(page(0, 0))).toBeUndefined();
  });
});
