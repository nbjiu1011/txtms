import { describe, expect, it } from "vitest";
import { eucKrEncodable, smsBytes, smsFullText, textBytes, textChars, unsupportedChars } from "./sms";

describe("textBytes", () => {
  it("counts ASCII as 1 byte and other code points as 2 (EUC-KR)", () => {
    expect(textBytes("abc 123")).toBe(7);
    expect(textBytes("한글")).toBe(4);
    expect(textBytes("[한빛]A")).toBe(7);
    expect(textBytes("")).toBe(0);
  });

  it("counts a surrogate pair (emoji) as one code point of 2 bytes", () => {
    expect(textBytes("😀")).toBe(2);
    expect(textBytes("똠😀")).toBe(4);
  });
});

describe("textChars", () => {
  it("counts code points including spaces and line breaks", () => {
    expect(textChars("a 😀\n가")).toBe(5);
    expect(textChars("")).toBe(0);
  });
});

describe("EUC-KR (KS X 1001) characters", () => {
  // the same strings are checked by the server (SmsBytesAndLinksTest) so both sides agree
  it("accepts ASCII, Hangul syllables of KS X 1001, symbols and hanja", () => {
    expect(unsupportedChars("abc 123 한글 가나다 ㄱ ① ※ € ® 漢字\n")).toEqual([]);
  });

  it("lists characters outside KS X 1001 once each, in order", () => {
    expect(unsupportedChars("똠방각하 😀 똠 뷁")).toEqual(["똠", "😀", "뷁"]);
  });

  it("does not take the windows-949 extension or the private use area", () => {
    expect(eucKrEncodable("한".codePointAt(0) ?? 0)).toBe(true);
    expect(eucKrEncodable("똠".codePointAt(0) ?? 0)).toBe(false);
    expect(eucKrEncodable(0xe000)).toBe(false);
    expect(eucKrEncodable("A".codePointAt(0) ?? 0)).toBe(true);
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

  it("matches the seeded 해외 결제 SMS (159 bytes)", () => {
    const body =
      "(광고)[한빛카드] 해외 결제 수수료가 10월 31일까지 면제됩니다. 면제 대상 카드는 홈페이지에서 확인하실 수 있습니다.";
    expect(smsBytes({ body, customerCenter: true, optOut: true })).toBe(159);
  });
});
