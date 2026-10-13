import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal, type ModalProps } from "./modal";
import { useToastStore } from "@/shared/ui";

function Harness(props: Partial<ModalProps> & { withInput?: boolean }) {
  const { withInput = true, ...rest } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <Modal open={open} title="비밀번호 재설정" onClose={() => setOpen(false)} okLabel="확인" {...rest}>
        {withInput ? (
          <>
            <input type="checkbox" aria-label="동의" />
            <input aria-label="이메일" />
          </>
        ) : (
          <p>내용</p>
        )}
      </Modal>
    </>
  );
}

afterEach(() => {
  useToastStore.setState({ message: null });
});

describe("Modal", () => {
  it("is a labelled modal dialog that focuses the first text control (not checkboxes)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    const dialog = screen.getByRole("dialog", { name: "비밀번호 재설정" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("이메일"));
  });

  it("focuses the close button when the body has no input", async () => {
    const user = userEvent.setup();
    render(<Harness withInput={false} />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "닫기" }));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "열기" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on scrim click but not on clicks inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    // radix dismisses on a pointer down outside the dialog (the scrim)
    await user.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    const ok = screen.getByRole("button", { name: "확인" });
    ok.focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "닫기" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(ok);
  });

  it("runs an async onOk once even on double click, then closes", async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => {};
    const onOk = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<Harness onOk={onOk} />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    const ok = screen.getByRole("button", { name: "확인" });
    await user.click(ok);
    await user.click(ok);
    expect(onOk).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open when onOk returns false", async () => {
    const user = userEvent.setup();
    render(<Harness onOk={() => false} />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("stays open and shows a toast when onOk throws", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        onOk={() => {
          throw new Error("권한 또는 요청 상태가 변경되었습니다");
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "열기" }));
    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(useToastStore.getState().message).toBe("권한 또는 요청 상태가 변경되었습니다");
  });

  it("uses the cancel label and closes with it", async () => {
    const user = userEvent.setup();
    render(<Harness cancelLabel="계속 편집" />);
    await user.click(screen.getByRole("button", { name: "열기" }));
    await user.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
