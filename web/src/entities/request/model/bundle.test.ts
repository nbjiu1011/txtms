import { describe, expect, it } from "vitest";
import { bundleVariableValues, completedCopyText, messageBodyText } from "./bundle";
import type { BundleVariable } from "./types";

const variables: BundleVariable[] = [
  { key: "customer_name", type: "TEXT", value: "홍길동" },
  { key: "billing_amount", type: "TEXT", value: "152,300원" },
];

describe("messageBodyText", () => {
  it("uses the body of 알림톡 and 문자 (no buttons, no notice lines)", () => {
    expect(
      messageBodyText("ALIMTALK", { templateCode: "T", body: "본문", buttons: [{ name: "자세히", link: "https://x" }] }),
    ).toBe("본문");
    expect(messageBodyText("SMS", { sender: "1588", body: "문자 본문", customerCenter: true, optOut: true })).toBe(
      "문자 본문",
    );
  });

  it("joins RCS card bodies with line breaks (card titles excluded)", () => {
    const card = { title: "제목", imageKey: null, imageAlt: "", buttonName: "", buttonLink: "" };
    expect(messageBodyText("RCS", { cards: [{ ...card, body: "첫 카드" }, { ...card, body: "둘째 카드" }] })).toBe(
      "첫 카드\n둘째 카드",
    );
  });

  it("uses the text of 자유입력형 (title excluded) and tolerates missing keys", () => {
    expect(messageBodyText("FREEFORM", { title: "제목", text: "본문" })).toBe("본문");
    expect(messageBodyText("FREEFORM", {} as never)).toBe("");
  });
});

describe("completedCopyText", () => {
  it("substitutes completion-time values and keeps unknown tokens", () => {
    const payload = {
      templateCode: "HB_BILL_02",
      body: "#{customer_name}님, 청구 금액은 #{billing_amount}입니다. #{payment_day}",
      buttons: [],
    };
    expect(completedCopyText("ALIMTALK", { payload }, variables)).toBe(
      "홍길동님, 청구 금액은 152,300원입니다. #{payment_day}",
    );
  });

  it("builds the value map from the bundle variables", () => {
    expect(bundleVariableValues(variables).get("billing_amount")).toBe("152,300원");
  });
});
