import { describe, expect, it } from "vitest";
import { normalizePayload, resolveVariables, segmentVariables, textFields } from "./payload";

describe("segmentVariables", () => {
  const values = new Map([["customer_name", "홍길동"]]);

  it("replaces known variables and keeps unknown ones as tokens", () => {
    expect(segmentVariables("#{customer_name}님, #{마감일}까지", values)).toEqual([
      { kind: "text", text: "홍길동님, " },
      { kind: "var", key: "마감일" },
      { kind: "text", text: "까지" },
    ]);
  });

  it("keeps every token without values", () => {
    expect(segmentVariables("#{a}#{b}")).toEqual([
      { kind: "var", key: "a" },
      { kind: "var", key: "b" },
    ]);
  });

  it("resolves to text", () => {
    expect(resolveVariables("#{customer_name} / #{x}", values)).toBe("홍길동 / #{x}");
  });
});

describe("textFields", () => {
  it("lists contract paths per type", () => {
    expect(textFields("ALIMTALK", { templateCode: "T", body: "b", buttons: [{ name: "n", link: "l" }] })).toEqual([
      ["body", "b"],
      ["buttons.0.name", "n"],
    ]);
    expect(textFields("FREEFORM", { title: "t", text: "x" })).toEqual([
      ["title", "t"],
      ["text", "x"],
    ]);
  });

  it("tolerates missing keys", () => {
    expect(normalizePayload("RCS", {} as never)).toEqual({ cards: [] });
  });
});
