import { describe, expect, it } from "vitest";
import { insertToken, variableToken } from "./insert-token";

describe("insertToken", () => {
  it("inserts at the caret and moves the caret after the token", () => {
    expect(insertToken("안녕하세요 님", "customer_name", 6)).toEqual({
      value: "안녕하세요 #{customer_name}님",
      caret: 6 + variableToken("customer_name").length,
    });
  });

  it("replaces the selected text", () => {
    expect(insertToken("고객명님, 안녕하세요", "customer_name", 0, 3)).toEqual({
      value: "#{customer_name}님, 안녕하세요",
      caret: 16,
    });
  });

  it("appends at the end without a caret and clamps positions", () => {
    expect(insertToken("본문", "points").value).toBe("본문#{points}");
    expect(insertToken("본문", "points", 99).value).toBe("본문#{points}");
    expect(insertToken("본문", "points", -3, 1)).toEqual({ value: "#{points}문", caret: 9 });
    expect(insertToken("", "a", 0)).toEqual({ value: "#{a}", caret: 4 });
  });
});
