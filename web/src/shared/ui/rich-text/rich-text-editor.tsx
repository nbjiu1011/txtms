"use client";

import "quill/dist/quill.snow.css";
import { useEffect, useLayoutEffect, useRef } from "react";
import type Quill from "quill";
import { cn } from "@/shared/lib";
import { toast } from "../overlay/toast";
import {
  RICH_TEXT_IMAGE_MAX_BYTES,
  RICH_TEXT_IMAGE_TOO_LARGE,
  RICH_TEXT_IMAGE_TYPE,
  RICH_TEXT_IMAGE_TYPES,
  toRichHtml,
} from "./rich-text";
import styles from "./rich-text.module.css";

/** Default toolbar: font, size, B I U S, text / background color, ordered / bullet list, align, link, image. */
export const RICH_TEXT_TOOLBAR = [
  [{ font: [] }, { size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }, { align: [] }],
  ["link", "image"],
];

export interface RichTextEditorProps {
  /** HTML (or plain text written before the editor, loaded as paragraphs). */
  value: string;
  /** Editor HTML after every change (`<p><br></p>` when empty — check with `isRichTextEmpty`). */
  onChange: (html: string) => void;
  /** Accessible name of the editing area (a `<label>` cannot point at it). */
  "aria-label": string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Rich text editor (Quill 2, snow theme) with the default toolbar. Quill touches the DOM on import, so it is
 * loaded in the browser only. Images are embedded as data URLs: PNG/JPG/GIF/WEBP up to 1 MB.
 */
export function RichTextEditor({ value, onChange, placeholder, invalid, className, ...rest }: RichTextEditorProps) {
  const ariaLabel = rest["aria-label"];
  const host = useRef<HTMLDivElement>(null);
  const quill = useRef<Quill | null>(null);
  /** The last HTML emitted or loaded: a `value` equal to it is not reloaded (keeps the caret). */
  const current = useRef<string | null>(null);
  const latest = useRef({ value, onChange });
  useLayoutEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let disposed = false;
    const editorEl = document.createElement("div");
    root.appendChild(editorEl);

    void import("quill").then(({ default: QuillClass }) => {
      if (disposed) return;
      const q = new QuillClass(editorEl, {
        theme: "snow",
        placeholder,
        modules: {
          toolbar: { container: RICH_TEXT_TOOLBAR, handlers: { image: () => pickImage(q) } },
        },
      });
      q.root.setAttribute("role", "textbox");
      q.root.setAttribute("aria-multiline", "true");
      q.root.setAttribute("aria-label", ariaLabel);
      current.current = load(q, latest.current.value);
      q.on("text-change", () => {
        const html = q.root.innerHTML;
        current.current = html;
        latest.current.onChange(html);
      });
      quill.current = q;
    });

    return () => {
      disposed = true;
      quill.current = null;
      current.current = null;
      root.replaceChildren();
    };
    // Created once per mount; later props are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An outside value (reset, another record) replaces the document.
  useEffect(() => {
    const q = quill.current;
    if (q && value !== current.current) current.current = load(q, value);
  }, [value]);

  return <div ref={host} className={cn(styles.editor, className)} aria-invalid={invalid || undefined} />;
}

/** Replaces the document without a change event; returns the loaded value. */
function load(q: Quill, html: string): string {
  q.setContents(q.clipboard.convert({ html: toRichHtml(html) }), "silent");
  return html;
}

/** Toolbar image button: a file of the allowed types and size, embedded at the caret as a data URL. */
function pickImage(q: Quill) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = RICH_TEXT_IMAGE_TYPES.join(",");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!(RICH_TEXT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast(RICH_TEXT_IMAGE_TYPE);
      return;
    }
    if (file.size > RICH_TEXT_IMAGE_MAX_BYTES) {
      toast(RICH_TEXT_IMAGE_TOO_LARGE);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const range = q.getSelection(true);
      q.insertEmbed(range.index, "image", String(reader.result), "user");
      q.setSelection(range.index + 1, 0, "silent");
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
