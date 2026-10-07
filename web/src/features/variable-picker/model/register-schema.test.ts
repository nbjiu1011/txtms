import { describe, expect, it } from "vitest";
import { variableRegisterSchema, variableValueError } from "./register-schema";

const issues = (input: Record<string, string>) =>
  variableRegisterSchema.safeParse({ type: "TEXT", description: "", value: "v", ...input }).error?.issues ?? [];

describe("variable registration", () => {
  it("requires a lowercase key", () => {
    expect(issues({ key: "" })[0].message).toBe("변수 키를 입력하세요");
    expect(issues({ key: "고객명" })[0].message).toBe("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
    expect(issues({ key: "Customer" })[0].message).toBe("변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요");
    expect(issues({ key: "customer_name_2" })).toEqual([]);
  });

  it("validates the value by type", () => {
    expect(variableValueError("NUMBER", "1.5")).toBeNull();
    expect(variableValueError("NUMBER", "다섯")).toBe("정수 또는 소수를 입력하세요");
    expect(variableValueError("DATE", "2026-02-30")).toBe("유효한 YYYY-MM-DD 날짜를 입력하세요");
    expect(variableValueError("DATE", "2026-10-07")).toBeNull();
    expect(variableValueError("LINK", "ftp://x.kr")).toBe("HTTP/HTTPS 링크를 입력하세요");
    expect(variableValueError("LINK", "x")).toBe("유효한 링크를 입력하세요");
    expect(variableValueError("TEXT", " ")).toBe("값을 입력하세요");
    expect(issues({ key: "k", type: "NUMBER", value: "x" }).map((i) => i.path)).toEqual([["value"]]);
  });
});
