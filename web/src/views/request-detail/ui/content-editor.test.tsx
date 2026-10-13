import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChannelSpec, Content, ContentPayload, ContentType, RcsPayload } from "@/entities/request";
import { ContentEditor } from "./content-editor";
import { chooseValue } from "@/shared/common/testing";

function content(payload: ContentPayload): Content {
  return { key: "C1", title: "콘텐츠 1", version: 1, payload, files: [], lock: null, savedAt: null, versions: [] };
}

const SPEC: ChannelSpec = {
  alimtalk: { bodyMaxChars: 1000, buttonsMax: 5, buttonNameMaxChars: 14 },
  sms: { smsMaxBytes: 90, lmsMaxBytes: 2000, encoding: "EUC-KR" },
};
const VALUES = new Map([["customer_name", "홍길동"]]);
const NOTICE = "채널 규격 안내는 작성·검수 지원용이며 발송 가능 여부나 외부 심사 통과를 보증하지 않습니다";

function renderEditor(
  type: ContentType,
  payload: ContentPayload,
  onPayload = vi.fn(),
  spec: ChannelSpec | null = SPEC,
) {
  render(
    <ContentEditor
      requestId="REQ-T"
      type={type}
      content={content(payload)}
      project={null}
      disabled={false}
      onPayload={onPayload}
      channelSpec={spec}
      values={VALUES}
    />,
  );
  return onPayload;
}

/** Texts of the spec notes ("주의"/"안내" label + message). */
function notes(): string[] {
  const list = screen.queryByRole("list", { name: "채널 규격 안내" });
  return list ? Array.from(list.querySelectorAll("li")).map((li) => li.textContent ?? "") : [];
}

function counterText(start: RegExp): string {
  return screen.getByText(start).parentElement?.textContent ?? "";
}

describe("ContentEditor (draft editing)", () => {
  it("counts 알림톡 characters live and adds/removes buttons beyond the spec of 5", () => {
    const buttons = Array.from({ length: 5 }, (_, i) => ({ name: `b${i}`, link: "https://x.kr" }));
    const onPayload = renderEditor("ALIMTALK", { templateCode: "", body: "가나다", buttons });
    expect(screen.getByText(/^3자/)).toBeTruthy();
    expect(screen.getByText("본문 최대 1,000자 · 버튼 5개 · 버튼명 14자")).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(notes()).toEqual([]);
    const add = screen.getByRole("button", { name: "버튼 추가" }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(onPayload.mock.calls[0][0].buttons).toHaveLength(6);
    onPayload.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "버튼 2 삭제" }));
    expect(onPayload.mock.calls[0][0].buttons.map((b: { name: string }) => b.name)).toEqual(["b0", "b2", "b3", "b4"]);
    fireEvent.change(screen.getByRole("textbox", { name: "본문" }), { target: { value: "#{customer_name}님" } });
    expect(onPayload.mock.calls[1][0].body).toBe("#{customer_name}님");
  });

  it("warns (never blocks) on the 알림톡 body, button count and button names", () => {
    const buttons = Array.from({ length: 6 }, (_, i) => ({ name: i === 0 ? "가".repeat(15) : `b${i}`, link: "" }));
    renderEditor("ALIMTALK", { templateCode: "", body: "#{customer_name}님 " + "가".repeat(983), buttons });
    // raw 16 + 1 + 1 + 983 = 1,001 characters, 3 + 1 + 1 + 983 = 988 with the current variable value
    expect(screen.getByText("1,001자")).toBeTruthy();
    expect(screen.getByText("예상 988자 (변수 적용)")).toBeTruthy();
    expect(notes()).toEqual([
      "주의본문 1,000자 초과 (1,001자)",
      "주의버튼 5개 초과 (6개)",
      `주의버튼 1: 버튼명 14자 초과 (${"가".repeat(15)})`,
    ]);
    expect(screen.getByRole("textbox", { name: "버튼 1 이름" }).className).toMatch(/inputWarn/);
    expect((screen.getByRole("button", { name: "버튼 추가" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("stops adding buttons at the storage cap of 20", () => {
    const buttons = Array.from({ length: 20 }, (_, i) => ({ name: `b${i}`, link: "https://x.kr" }));
    renderEditor("ALIMTALK", { templateCode: "", body: "", buttons });
    expect((screen.getByRole("button", { name: "버튼 추가" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("버튼은 최대 20개까지 저장할 수 있습니다")).toBeTruthy();
  });

  it("shows SMS bytes with the notice lines", () => {
    renderEditor("SMS", { sender: "", body: "가", customerCenter: true, optOut: false });
    // 2 bytes + newline + 고객센터 1588-0000 (19 bytes)
    expect(counterText(/^21바이트/)).toBe("21바이트 · SMS (안내 문구 포함)");
    expect(notes()).toEqual([]);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("shows expected SMS bytes, the LMS notice and unsupported characters", () => {
    const body = "#{customer_name}님 " + "가".repeat(40) + " 똠😀";
    renderEditor("SMS", { sender: "", body, customerCenter: false, optOut: false });
    // raw 16 + 2 + 1 + 80 + 1 + 4 = 104, expected 6 + 2 + 1 + 80 + 1 + 4 = 94
    expect(counterText(/^104바이트/)).toBe("104바이트 · 예상 94바이트 (변수 적용) · LMS 예상 (안내 문구 포함)");
    expect(notes()).toEqual([
      "안내SMS 90바이트 초과 — LMS 예상 전환 (실제 유형은 바뀌지 않습니다)",
      "주의EUC-KR로 표현할 수 없는 문자: 똠, 😀 (2바이트로 계산)",
    ]);
  });

  it("warns above the LMS limit", () => {
    renderEditor("SMS", { sender: "", body: "a".repeat(1974), customerCenter: false, optOut: true });
    expect(notes()).toEqual(["주의LMS 2,000바이트 초과 (2,001바이트)"]);
  });

  it("counts without limits while the spec is loading", () => {
    renderEditor("SMS", { sender: "", body: "a".repeat(100), customerCenter: false, optOut: false }, vi.fn(), null);
    expect(counterText(/^100바이트/)).toBe("100바이트 (안내 문구 포함)");
    expect(notes()).toEqual([]);
  });

  it("changes the RCS card count", () => {
    const payload: RcsPayload = {
      cards: [{ title: "", body: "a", imageKey: null, imageAlt: "", buttonName: "", buttonLink: "" }],
    };
    const onPayload = renderEditor("RCS", payload);
    chooseValue(screen.getByRole("combobox", { name: "카드 수" }), "3");
    expect(onPayload.mock.calls[0][0].cards).toHaveLength(3);
    expect(onPayload.mock.calls[0][0].cards[0].body).toBe("a");
  });

  it("is read-only without an edit handler", () => {
    render(
      <ContentEditor
        requestId="REQ-T"
        type="ALIMTALK"
        content={content({ templateCode: "", body: "x", buttons: [] })}
        project={null}
        disabled
      />,
    );
    expect(screen.queryByRole("button", { name: "버튼 추가" })).toBeNull();
    expect(screen.getByText("버튼 없음")).toBeTruthy();
  });
});
