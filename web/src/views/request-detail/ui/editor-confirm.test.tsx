import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Content, FileMeta } from "@/entities/request";
import { EditorToolbar } from "./editor-bars";
import { FreeformFields } from "./freeform-fields";

const FILE: FileMeta = {
  id: 7,
  name: "notes.txt",
  ext: "TXT",
  unit: "PAGE",
  sizeBytes: 120,
  totalAmount: 2,
  reviewAmount: 2,
  rangeNote: null,
  version: 1,
  scanStatus: "SAFE",
  versions: [],
};

function content(files: FileMeta[] = []): Content {
  return {
    key: "C1",
    title: "약관 안내",
    version: 2,
    payload: { title: "", text: "" },
    files,
    lock: null,
    savedAt: null,
    versions: [],
  } as unknown as Content;
}

describe("destructive editor actions ask first", () => {
  it("attachment 삭제 opens a confirmation naming the file; 취소 keeps it", async () => {
    const onDelete = vi.fn();
    render(
      <FreeformFields
        requestId="REQ-T"
        content={content([FILE])}
        payload={{ title: "", text: "" }}
        disabled={false}
        onPayload={vi.fn()}
        attachments={{
          range: () => ({ totalAmount: "2", reviewAmount: "2", rangeNote: "" }),
          onRange: vi.fn(),
          onDelete,
          busy: false,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "notes.txt 삭제" }));
    const dialog = screen.getByRole("dialog", { name: "첨부파일 「notes.txt」을(를) 삭제할까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "notes.txt 삭제" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(FILE));
  });

  it("변경 취소 (unsaved revision) is a warn button that confirms before dropping the buffer", async () => {
    const onDiscard = vi.fn();
    render(
      <EditorToolbar
        content={content()}
        draft={null}
        revision={{ buffered: true, saving: false, onSave: vi.fn(), onDiscard }}
        variables={null}
        onCompare={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }));
    expect(onDiscard).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "C1 약관 안내의 수정 내용을 버릴까요?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "변경 취소" }));
    await waitFor(() => expect(onDiscard).toHaveBeenCalled());
  });
});
