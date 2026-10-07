import { describe, expect, it } from "vitest";
import { isShortSms, smsBytes, smsFullText, textBytes } from "./sms";

describe("textBytes", () => {
  it("counts ASCII as 1 byte and code points above 127 as 2", () => {
    expect(textBytes("abc 123")).toBe(7);
    expect(textBytes("한글")).toBe(4);
    expect(textBytes("[한빛]A")).toBe(7);
    expect(textBytes("")).toBe(0);
  });

  it("counts a surrogate pair (emoji) as one code point", () => {
    expect(textBytes("😀")).toBe(2);
  });
});

describe("smsBytes", () => {
  const base = { body: "안녕", customerCenter: false, optOut: false };

  it("is the body only without notices", () => {
    expect(smsBytes(base)).toBe(4);
  });

  it("adds the customer-center line (newline + 고객센터 1588-0000)", () => {
    expect(smsFullText({ ...base, customerCenter: true })).toBe("안녕\n고객센터 1588-0000");
    expect(smsBytes({ ...base, customerCenter: true })).toBe(4 + 1 + 8 + 1 + 9);
  });

  it("adds the opt-out line (newline + 무료 수신거부 080-000-0000)", () => {
    expect(smsFullText({ ...base, optOut: true })).toBe("안녕\n무료 수신거부 080-000-0000");
    expect(smsBytes({ ...base, optOut: true })).toBe(4 + 1 + 4 + 1 + 8 + 1 + 12);
  });

  it("matches the seeded 해외 결제 SMS (159 bytes, 장문)", () => {
    const body =
      "(광고)[한빛카드] 해외 결제 수수료가 10월 31일까지 면제됩니다. 면제 대상 카드는 홈페이지에서 확인하실 수 있습니다.";
    const bytes = smsBytes({ body, customerCenter: true, optOut: true });
    expect(bytes).toBe(159);
    expect(isShortSms(bytes)).toBe(false);
  });

  it("treats 90 bytes as short and 91 as long", () => {
    expect(isShortSms(90)).toBe(true);
    expect(isShortSms(91)).toBe(false);
  });
});
