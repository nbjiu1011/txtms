import { describe, expect, it } from "vitest";
import { checkAlimtalk, checkSms, formatCount, peak, smsKind } from "./channel-spec";
import type { ChannelSpec } from "./types";

const SPEC: ChannelSpec = {
  alimtalk: { bodyMaxChars: 1000, buttonsMax: 5, buttonNameMaxChars: 14 },
  sms: { smsMaxBytes: 90, lmsMaxBytes: 2000, encoding: "EUC-KR" },
};
const VALUES = new Map([["customer_name", "홍길동"]]);

describe("checkAlimtalk", () => {
  it("measures the body raw and with the current variable values", () => {
    const c = checkAlimtalk({ body: "#{customer_name}님 #{ghost}", buttons: [] }, SPEC.alimtalk, VALUES);
    expect(c.body).toEqual({ raw: 26, expected: 13, hasVariables: true });
    expect(c.bodyOver).toBe(false);
  });

  it("flags the body, button count and long button names", () => {
    const buttons = Array.from({ length: 6 }, (_, i) => ({ name: i === 1 ? "가".repeat(15) : "보기", link: "" }));
    const c = checkAlimtalk({ body: "가".repeat(1001), buttons }, SPEC.alimtalk);
    expect(c.body).toEqual({ raw: 1001, expected: 1001, hasVariables: false });
    expect(c.bodyOver).toBe(true);
    expect(c.buttonsOver).toBe(true);
    expect(c.longNames).toEqual([false, true, false, false, false, false]);
  });

  it("counts code points and exactly the limit is fine", () => {
    const c = checkAlimtalk({ body: "가".repeat(999) + "😀", buttons: [{ name: "가".repeat(14), link: "" }] }, SPEC.alimtalk);
    expect(c.body.raw).toBe(1000);
    expect(c.bodyOver).toBe(false);
    expect(c.longNames).toEqual([false]);
  });

  it("is exceeded when only the variable-applied body is longer", () => {
    const long = new Map([["customer_name", "가".repeat(20)]]);
    const c = checkAlimtalk({ body: "가".repeat(990) + "#{customer_name}", buttons: [] }, SPEC.alimtalk, long);
    expect(c.body.raw).toBe(1006);
    expect(c.body.expected).toBe(1010);
    expect(peak(c.body)).toBe(1010);
    expect(c.bodyOver).toBe(true);
  });
});

describe("checkSms", () => {
  it("is SMS up to 90 bytes, LMS above, OVER above 2,000", () => {
    expect(smsKind(90, SPEC.sms)).toBe("SMS");
    expect(smsKind(91, SPEC.sms)).toBe("LMS");
    expect(smsKind(2000, SPEC.sms)).toBe("LMS");
    expect(smsKind(2001, SPEC.sms)).toBe("OVER");
  });

  it("counts the notice lines and applies variables", () => {
    const c = checkSms({ body: "#{customer_name}님", customerCenter: true, optOut: false }, SPEC.sms, VALUES);
    // raw 16 + 2 + 19, expected 6 + 2 + 19
    expect(c.bytes).toEqual({ raw: 37, expected: 27, hasVariables: true });
    expect(c.kind).toBe("SMS");
    expect(c.unsupported).toEqual([]);
  });

  it("lists unsupported characters of the text and of the variable values", () => {
    const values = new Map([["customer_name", "똠"]]);
    const c = checkSms({ body: "😀 #{customer_name}", customerCenter: false, optOut: false }, SPEC.sms, values);
    expect(c.unsupported).toEqual(["😀", "똠"]);
  });

  it("uses the larger of raw and expected bytes for the kind", () => {
    const c = checkSms({ body: "a".repeat(80) + "#{customer_name}", customerCenter: false, optOut: false }, SPEC.sms, VALUES);
    expect(c.bytes.raw).toBe(96);
    expect(c.bytes.expected).toBe(86);
    expect(c.kind).toBe("LMS");
  });
});

describe("formatCount", () => {
  it("uses thousands separators", () => {
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(90)).toBe("90");
  });
});
