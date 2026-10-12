import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./rich-text-editor";
import { RichTextView } from "./rich-text-view";
import { isRichText, isRichTextEmpty, richTextPlain, toRichHtml } from "./rich-text";

describe("rich text values", () => {
  it("tells editor HTML from plain text and finds empty documents", () => {
    expect(isRichText("<p>a</p>")).toBe(true);
    expect(isRichText("정기 점검\n2시")).toBe(false);
    expect(isRichTextEmpty("<p><br></p>")).toBe(true);
    expect(isRichTextEmpty("<p> &nbsp;</p>")).toBe(true);
    expect(isRichTextEmpty("<p><img src=\"data:image/png;base64,AA==\"></p>")).toBe(false);
    expect(isRichTextEmpty("본문")).toBe(false);
    expect(isRichTextEmpty("")).toBe(true);
    expect(richTextPlain("<p><strong>굵게</strong> 글</p>")).toBe("굵게 글");
  });

  it("loads plain text as escaped paragraphs", () => {
    expect(toRichHtml("1 < 2\n\n끝")).toBe("<p>1 &lt; 2</p><p><br></p><p>끝</p>");
    expect(toRichHtml("<p>a</p>")).toBe("<p>a</p>");
  });
});

describe("RichTextView", () => {
  it("renders sanitized HTML and keeps plain text line breaks", () => {
    const { container, rerender } = render(
      <RichTextView value={'<p><strong>공지</strong><img src="x" onerror="alert(1)"><script>alert(1)</script></p>'} />,
    );
    expect(container.querySelector(".ql-editor strong")?.textContent).toBe("공지");
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("script");
    rerender(<RichTextView value={"첫 줄\n둘째 줄"} />);
    expect(container.textContent).toBe("첫 줄\n둘째 줄");
  });
});

describe("RichTextEditor", () => {
  it("shows the default toolbar and reports the document as HTML", async () => {
    const onChange = vi.fn();
    const { container } = render(<RichTextEditor aria-label="내용" value={"기존 공지"} onChange={onChange} />);
    const box = await screen.findByRole("textbox", { name: "내용" });
    expect(box.innerHTML).toBe("<p>기존 공지</p>");
    for (const format of ["bold", "italic", "underline", "strike", "link", "image"]) {
      expect(container.querySelector(`.ql-toolbar button.ql-${format}`), format).toBeTruthy();
    }
    expect(container.querySelectorAll(".ql-toolbar button.ql-list")).toHaveLength(2);
    for (const picker of ["font", "size", "color", "background", "align"]) {
      expect(container.querySelector(`.ql-toolbar .ql-${picker}`), picker).toBeTruthy();
    }
    // loading a value is silent; typing reports HTML
    expect(onChange).not.toHaveBeenCalled();
    box.innerHTML = "<p>새 내용</p>";
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<p>새 내용</p>"));
  });
});
