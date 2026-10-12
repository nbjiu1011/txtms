import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clampPage, useClampPage, useListPage } from "./list-page";

describe("clampPage", () => {
  it("keeps a page that exists", () => {
    expect(clampPage(0, 3)).toBe(0);
    expect(clampPage(2, 3)).toBe(2);
  });

  it("moves past-the-end pages to the last page, and to 0 for an empty list", () => {
    expect(clampPage(3, 3)).toBe(2);
    expect(clampPage(5, 1)).toBe(0);
    expect(clampPage(2, 0)).toBe(0);
  });
});

describe("useListPage", () => {
  it("goes back to page 0 when the reset key changes", () => {
    const { result, rerender } = renderHook(({ k }) => useListPage(k), { initialProps: { k: "a" } });
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    rerender({ k: "b" });
    expect(result.current[0]).toBe(0);
    act(() => result.current[1](1));
    expect(result.current[0]).toBe(1);
  });
});

describe("useClampPage", () => {
  it("clamps once the total is known and ignores an unknown total", () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number | undefined }) => {
        const [page, setPage] = useListPage("k");
        useClampPage(page, total, setPage);
        return { page, setPage };
      },
      { initialProps: { total: undefined as number | undefined } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    rerender({ total: 2 });
    expect(result.current.page).toBe(1);
  });
});
