import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CorrectionCheckItem, CorrectionResult } from "@/entities/correction";
import type { ContentPayload, ContentType } from "@/entities/request";
import { ApiError } from "@/shared/api";
import { useToastStore } from "@/shared/ui";
import { useCorrection, type CorrectionContent, type CorrectionEditor } from "../model/use-correction";
import { CorrectionPanel, EXCLUDED_NOTE, STALE_NOTE } from "./correction-panel";

// The full suite runs files in parallel: give the first check of a cold module more than 1s.
configure({ asyncUtilTimeout: 5000 });

const api = vi.hoisted(() => ({
  check: vi.fn(),
  event: vi.fn(),
  suggest: vi.fn(),
  dataset: { assigned: true, datasetLabel: "알림톡 v4" } as { assigned: boolean; datasetLabel: string | null },
}));

vi.mock("@/entities/correction", () => ({
  correctionApi: { check: api.check, event: api.event, suggest: api.suggest },
  useCorrectionDataset: () => ({ data: api.dataset, isPending: false, isError: false }),
}));

const opt = (recommended: string | null, label = "띄어쓰기", description = "설명") => ({
  ruleId: `R-${recommended}`,
  recommended,
  descriptionLabel: label,
  description,
});

/** Groups the fake engine reports for a body (positions computed from the text). */
function engine(item: CorrectionCheckItem): CorrectionResult {
  const body = (item.payload as { body?: string; text?: string }).body ?? (item.payload as { text: string }).text;
  const field = "body" in item.payload ? "body" : "text";
  const rules: [string, ReturnType<typeof opt>[]][] = [
    ["할수", [opt("할 수", "띄어쓰기", "의존 명사 수는 띄어 씁니다")]],
    ["수령인", [opt("받는 사람", "어려운 한자어", "사람 설명"), opt("받는 분", "높임 표현", "분 설명")]],
    ["처리", [opt(null, "군더더기 표현", "되도록 삭제해 주세요")]],
  ];
  const groups = rules.flatMap(([matched, options]) => {
    const start = body.indexOf(matched);
    return start < 0 ? [] : [{ id: `${field}:${start}:${start + matched.length}`, field, start, end: start + matched.length, matchedText: matched, options }];
  });
  return { contentKey: item.contentKey, checkedAt: "", datasetLabel: "알림톡 v4", variablesRevision: 1, excluded: false, groups };
}

interface HarnessProps {
  type?: ContentType;
  contents: (CorrectionContent & { payload: ContentPayload })[];
  editable?: boolean;
  canSuggest?: boolean;
  currentKey?: string;
}

const writes: { key: string; payload: ContentPayload }[] = [];

function Harness({ type = "ALIMTALK", contents, editable = true, canSuggest = true, currentKey = "C1" }: HarnessProps) {
  const payloads = new Map(contents.map((c) => [c.key, c.payload]));
  for (const w of writes) payloads.set(w.key, w.payload);
  const editor: CorrectionEditor = {
    payloadOf: (key) => payloads.get(key) ?? null,
    canEdit: () => editable,
    begin: () => Promise.resolve(true),
    write: (key, payload) => writes.push({ key, payload }),
  };
  const correction = useCorrection({
    requestId: "REQ-T",
    type,
    contents,
    variablesRevision: 1,
    editor,
    onReveal: () => undefined,
  });
  return <CorrectionPanel requestId="REQ-T" correction={correction} currentKey={currentKey} canSuggest={canSuggest} />;
}

const alimtalk = (body: string): ContentPayload => ({ templateCode: "", body, buttons: [] });
const lastToast = () => useToastStore.getState().message;

beforeEach(() => {
  writes.length = 0;
  api.check.mockReset().mockImplementation((_id: string, items: CorrectionCheckItem[]) =>
    Promise.resolve({ results: items.map(engine) }),
  );
  api.event.mockReset().mockResolvedValue(undefined);
  api.suggest.mockReset().mockResolvedValue(undefined);
  api.dataset = { assigned: true, datasetLabel: "알림톡 v4" };
  useToastStore.setState({ message: null });
});

// Rendering-heavy flows: allow for a loaded machine when the whole suite runs in parallel.
describe("CorrectionPanel", { timeout: 20_000 }, () => {
  it("checks the current buffer and applies / restores a 1:1 recommendation", async () => {
    const { rerender } = render(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("참여는 할수 있습니다") }]} />);
    expect(screen.getByText(/교정 데이터셋 · 알림톡 v4/)).toBeTruthy();
    expect(screen.getByText("아직 검사하지 않았습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    await screen.findByText("할 수");
    expect(api.check).toHaveBeenCalledWith("REQ-T", [{ contentKey: "C1", payload: alimtalk("참여는 할수 있습니다"), hasFiles: false }]);
    const restore = screen.getByRole("button", { name: "할수(으)로 복원" }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "할 수" })));
    // Applying awaits the editor's begin() before writing; wait for the write instead of assuming one tick.
    await waitFor(() => expect(writes.at(-1)?.payload).toEqual(alimtalk("참여는 할 수 있습니다")));
    await waitFor(() => expect(lastToast()).toBe("교정이 적용되었습니다."));
    await waitFor(() => expect(api.event).toHaveBeenCalledWith("REQ-T", { contentKey: "C1", action: "APPLY", field: "body", before: "할수", after: "할 수", ruleId: "R-할 수" }));
    rerender(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("참여는 할수 있습니다") }]} />);
    expect(screen.getByRole("button", { name: "할 수" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText(STALE_NOTE)).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "할수(으)로 복원" })));
    await waitFor(() => expect(writes.at(-1)?.payload).toEqual(alimtalk("참여는 할수 있습니다")));
    await waitFor(() => expect(lastToast()).toBe("교정이 취소되었습니다."));
    await waitFor(() => expect(api.event).toHaveBeenLastCalledWith("REQ-T", { contentKey: "C1", action: "RESTORE", field: "body", before: "할 수", after: "할수", ruleId: "R-할 수" }));
  });

  it("1:N select applies at once and swaps directly; description-only shows no recommendation", async () => {
    render(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("수령인 처리") }]} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    const select = (await screen.findByRole("combobox", { name: "수령인 권장 표현 선택" })) as HTMLSelectElement;
    expect(select.value).toBe("");
    await act(async () => fireEvent.change(select, { target: { value: "0" } }));
    await waitFor(() => expect(writes.at(-1)?.payload).toEqual(alimtalk("받는 사람 처리")));
    await act(async () => fireEvent.change(select, { target: { value: "1" } }));
    await waitFor(() => expect(writes.at(-1)?.payload).toEqual(alimtalk("받는 분 처리")));
    await waitFor(() => expect(api.event).toHaveBeenLastCalledWith("REQ-T", expect.objectContaining({ before: "받는 사람", after: "받는 분", ruleId: "R-받는 분" })));
    expect(screen.getByText("높임 표현")).toBeTruthy();
    expect(screen.getByText("분 설명")).toBeTruthy();
    // 처리: label + reason only
    expect(screen.getByText("군더더기 표현")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "처리(으)로 복원" })).toBeNull();
  });

  it("shows a stale banner when the text changed after the check", async () => {
    const contents = [{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("할수 있다") }];
    const { rerender } = render(<Harness contents={contents} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    await screen.findByText("할 수");
    rerender(<Harness contents={[{ ...contents[0], payload: alimtalk("할수 있다!") }]} />);
    expect(screen.getByText(STALE_NOTE)).toBeTruthy();
    expect((screen.getByRole("button", { name: "할 수" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("read-only viewers can check but not apply, restore or suggest", async () => {
    render(<Harness editable={false} canSuggest={false} contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("할수") }]} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    expect(((await screen.findByRole("button", { name: "할 수" })) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "건의하기" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("전체 검사 groups results per content, lists excluded attachments and closes with 교정 완료", async () => {
    render(
      <Harness
        type="FREEFORM"
        contents={[
          { key: "C1", title: "첫째", fileCount: 0, payload: { title: "", text: "할수 수령인" } },
          { key: "C2", title: "둘째", fileCount: 2, payload: { title: "", text: "할수" } },
          { key: "C3", title: "셋째", fileCount: 0, payload: { title: "", text: "없음" } },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "전체 검사 2건" }));
    await screen.findByText("C2 · 첨부파일로 제외");
    expect(api.check.mock.calls[0][1].map((i: CorrectionCheckItem) => i.contentKey)).toEqual(["C1", "C3"]);
    expect(screen.getByRole("button", { name: /C1 · 첫째/ }).textContent).toContain("(2)");
    expect(screen.getByText("교정할 표현이 없습니다.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "할 수" })));
    await waitFor(() =>
      expect((screen.getByText(/교정 적용/).parentElement as HTMLElement).textContent).toBe("콘텐츠 2교정 적용 1교정 결과 2"),
    );
    fireEvent.click(screen.getByRole("button", { name: "교정 완료" }));
    expect(screen.queryByText("C2 · 첨부파일로 제외")).toBeNull();
    expect(screen.getByText("C1 · 첫째")).toBeTruthy();
  });

  it("a 자유입력형 with attachments shows the exclusion note and cannot be checked", () => {
    render(<Harness type="FREEFORM" contents={[{ key: "C1", title: "파일", fileCount: 1, payload: { title: "", text: "할수" } }]} />);
    expect(screen.getByText(EXCLUDED_NOTE)).toBeTruthy();
    expect((screen.getByRole("button", { name: "이 콘텐츠 검사" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops results once an attachment is added", async () => {
    const base = { key: "C1", title: "파일", payload: { title: "", text: "할수" } as ContentPayload };
    const { rerender } = render(<Harness type="FREEFORM" contents={[{ ...base, fileCount: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    await screen.findByText("할 수");
    rerender(<Harness type="FREEFORM" contents={[{ ...base, fileCount: 1 }]} />);
    expect(screen.getByText(EXCLUDED_NOTE)).toBeTruthy();
    rerender(<Harness type="FREEFORM" contents={[{ ...base, fileCount: 0 }]} />);
    expect(screen.getByText("아직 검사하지 않았습니다.")).toBeTruthy();
  });

  it("unassigned dataset: buttons look disabled, a click shows the server message", async () => {
    api.dataset = { assigned: false, datasetLabel: null };
    api.check.mockRejectedValue(
      new ApiError(409, { code: "DATASET_NOT_ASSIGNED", message: "유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요" }),
    );
    render(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("할수") }]} />);
    expect(screen.getByText("배정 필요")).toBeTruthy();
    const button = screen.getByRole("button", { name: "이 콘텐츠 검사" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    await waitFor(() => expect(lastToast()).toBe("유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요"));
  });

  it("sends a suggestion with the matched text and rule ids", async () => {
    render(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("수령인") }]} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    fireEvent.click(await screen.findByRole("button", { name: "건의하기" }));
    const dialog = await screen.findByRole("dialog", { name: "교정 건의하기" });
    expect(dialog.textContent).toContain("받는 사람 / 받는 분");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "건의 보내기" })));
    expect(lastToast()).toBe("건의 이유을(를) 입력하세요");
    fireEvent.change(screen.getByRole("textbox", { name: /건의 이유/ }), { target: { value: " 받으시는 분도 넣어 주세요 " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "건의 보내기" })));
    await waitFor(() => expect(api.suggest).toHaveBeenCalled());
    expect(api.suggest).toHaveBeenCalledWith("REQ-T", {
      contentKey: "C1",
      matchedText: "수령인",
      ruleIds: ["R-받는 사람", "R-받는 분"],
      body: "받으시는 분도 넣어 주세요",
    });
    expect(lastToast()).toBe("건의를 보냈습니다");
  });

  it("sends the optional 제안 표현 with the suggestion", async () => {
    render(<Harness contents={[{ key: "C1", title: "안내", fileCount: 0, payload: alimtalk("수령인") }]} />);
    fireEvent.click(screen.getByRole("button", { name: "이 콘텐츠 검사" }));
    fireEvent.click(await screen.findByRole("button", { name: "건의하기" }));
    await screen.findByRole("dialog", { name: "교정 건의하기" });
    fireEvent.change(screen.getByRole("textbox", { name: /건의 이유/ }), { target: { value: "추가 표현" } });
    fireEvent.change(screen.getByRole("textbox", { name: "제안 표현" }), { target: { value: "받으시는 분" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "건의 보내기" })));
    await waitFor(() => expect(api.suggest).toHaveBeenCalled());
    expect(api.suggest.mock.calls[0][1]).toMatchObject({ body: "추가 표현", suggestedExpr: "받으시는 분" });
  });
});
