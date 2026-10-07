"use client";

import { useRef, type RefObject, type SyntheticEvent } from "react";
import { defaultTextPath, getPayloadField, setPayloadField, type Content, type ContentType } from "@/entities/request";
import { insertToken } from "@/features/variable-picker";
import type { DraftSession } from "./draft-session";

interface Caret {
  path: string;
  start: number | null;
  end: number | null;
}

/**
 * Tracks the last focused text field of the editor (`data-path`) and its caret, and inserts
 * `#{key}` there (reference `insVar`: falls back to the end of 본문 / 자유입력 텍스트).
 */
export function useVariableInsertion(editorRef: RefObject<HTMLElement | null>) {
  const caret = useRef<Caret | null>(null);

  const track = (event: SyntheticEvent) => {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement;
    const path = el.dataset?.path;
    if (!path || !("selectionStart" in el)) return;
    caret.current = { path, start: el.selectionStart, end: el.selectionEnd };
  };

  const insert = (session: DraftSession, server: Content, type: ContentType, key: string) => {
    const payload = session.content(server).payload;
    const last = caret.current;
    const usable = last !== null && typeof getPayloadField(payload, last.path) === "string";
    const path = usable ? last.path : defaultTextPath(type);
    const value = String(getPayloadField(payload, path) ?? "");
    const result = usable ? insertToken(value, key, last.start, last.end) : insertToken(value, key);
    session.setPayload(server, setPayloadField(payload, path, result.value));
    caret.current = { path, start: result.caret, end: result.caret };
    requestAnimationFrame(() => {
      const field = editorRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-path="${path}"]`);
      if (!field) return;
      field.focus();
      field.setSelectionRange(result.caret, result.caret);
    });
  };

  return {
    handlers: { onFocusCapture: track, onSelectCapture: track, onKeyUpCapture: track, onMouseUpCapture: track },
    insert,
  };
}
