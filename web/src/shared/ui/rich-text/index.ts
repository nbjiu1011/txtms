/**
 * Rich text editor and viewer (Quill 2). A separate entry from `@/shared/ui` so screens without rich text do not
 * load Quill's stylesheet.
 */
export { RichTextEditor, RICH_TEXT_TOOLBAR } from "./rich-text-editor";
export type { RichTextEditorProps } from "./rich-text-editor";
export { RichTextView } from "./rich-text-view";
export type { RichTextViewProps } from "./rich-text-view";
export { isRichText, isRichTextEmpty, richTextPlain, toRichHtml } from "./rich-text";
