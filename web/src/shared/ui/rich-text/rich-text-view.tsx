"use client";

import "quill/dist/quill.snow.css";
import DOMPurify from "dompurify";
import { cn } from "@/shared/lib";
import { useMounted } from "../overlay/use-mounted";
import { isRichText } from "./rich-text";
import styles from "./rich-text.module.css";

/** Same allow-list as the server (contract §18); the server already stores sanitized HTML, this is a second guard. */
const ALLOWED = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "span", "ol", "ul", "li", "a", "img"],
  ALLOWED_ATTR: ["class", "style", "data-list", "href", "target", "rel", "src", "alt"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
};

export interface RichTextViewProps {
  value: string;
  className?: string;
}

/**
 * Read-only rendering of an editor value with the editor's typography. Plain text (written before the editor)
 * keeps its line breaks. Sanitizing needs the DOM, so rich values render after hydration.
 */
export function RichTextView({ value, className }: RichTextViewProps) {
  const mounted = useMounted();
  if (!isRichText(value)) return <div className={cn(styles.plain, className)}>{value}</div>;
  if (!mounted) return null;
  const html = DOMPurify.sanitize(value, ALLOWED);
  return (
    <div className={cn("ql-snow", className)}>
      {/* sanitized above with the server's allow-list */}
      <div className={cn("ql-editor", styles.view)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
