import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Content, ContentPayload, ContentType, RcsPayload } from "@/entities/request";
import { ContentEditor } from "./content-editor";

function content(payload: ContentPayload): Content {
  return { key: "C1", title: "콘텐츠 1", version: 1, payload, files: [], lock: null, savedAt: null, versions: [] };
}

function renderEditor(type: ContentType, payload: ContentPayload, onPayload = vi.fn()) {
  render(
    <ContentEditor
      requestId="REQ-T"
      type={type}
      content={content(payload)}
      project={null}
      disabled={false}
      onPayload={onPayload}
    />,
  );
  return onPayload;
}

describe("ContentEditor (draft editing)", () => {
  it("counts 알림톡 characters live and adds/removes buttons up to 5", () => {
    const buttons = Array.from({ length: 5 }, (_, i) => ({ name: `b${i}`, link: "https://x.kr" }));
    const onPayload = renderEditor("ALIMTALK", { templateCode: "", body: "가나다", buttons });
    expect(screen.getByText(/^3자/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "버튼 추가" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "버튼 2 삭제" }));
    expect(onPayload.mock.calls[0][0].buttons.map((b: { name: string }) => b.name)).toEqual(["b0", "b2", "b3", "b4"]);
    fireEvent.change(screen.getByRole("textbox", { name: "본문" }), { target: { value: "#{customer_name}님" } });
    expect(onPayload.mock.calls[1][0].body).toBe("#{customer_name}님");
  });

  it("shows SMS bytes with the notice lines", () => {
    renderEditor("SMS", { sender: "", body: "가", customerCenter: true, optOut: false });
    // 2 bytes + "\n고객센터 1588-0000" (19 bytes)
    expect(screen.getByText("21바이트 단문 (안내 문구 포함)")).toBeTruthy();
  });

  it("changes the RCS card count", () => {
    const payload: RcsPayload = {
      cards: [{ title: "", body: "a", imageKey: null, imageAlt: "", buttonName: "", buttonLink: "" }],
    };
    const onPayload = renderEditor("RCS", payload);
    fireEvent.change(screen.getByRole("combobox", { name: "카드 수" }), { target: { value: "3" } });
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
