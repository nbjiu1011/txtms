import { normalizePayload } from "./payload";
import type {
  AlimtalkPayload,
  Content,
  ContentPayload,
  ContentType,
  RcsCard,
  RcsPayload,
} from "./types";

/**
 * 알림톡 buttons the server stores per content (abuse guard, `LIMIT_EXCEEDED` above it). The channel spec
 * (`buttonsMax`, 5) is only a warning, so more buttons than the spec can be added up to this cap.
 */
export const MAX_ALIMTALK_BUTTONS_STORED = 20;
/** RCS cards per content (card count select 1–5). */
export const MIN_RCS_CARDS = 1;
export const MAX_RCS_CARDS = 5;
/** Empty RCS card. */
export const BLANK_CARD: Readonly<RcsCard> = {
  title: "",
  body: "",
  imageKey: null,
  imageAlt: "",
  buttonName: "",
  buttonLink: "",
};

/** Empty payload of a content type (reference `blankF`). */
export function blankPayload(type: ContentType): ContentPayload {
  switch (type) {
    case "ALIMTALK":
      return { templateCode: "", body: "", buttons: [] };
    case "SMS":
      return { sender: "", body: "", customerCenter: false, optOut: false };
    case "RCS":
      return { cards: [{ ...BLANK_CARD }] };
    case "FREEFORM":
      return { title: "", text: "" };
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The content still holds nothing the user typed or attached (reference `typeChange` check): a type
 * change only asks for confirmation when some content is not blank.
 */
export function isBlankContent(type: ContentType, content: Pick<Content, "payload" | "files">): boolean {
  if (content.files.length > 0) return false;
  return sameJson(normalizePayload(type, content.payload), blankPayload(type));
}

type PathKey = string | number;

function parsePath(path: string): PathKey[] {
  return path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/** Value at a dotted payload path (`body`, `buttons.0.name`, `cards.1.body`). */
export function getPayloadField(payload: ContentPayload, path: string): unknown {
  let node: unknown = payload;
  for (const key of parsePath(path)) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<PathKey, unknown>)[key];
  }
  return node;
}

/** Immutable set of a dotted payload path; only existing containers are followed. */
export function setPayloadField<P extends ContentPayload>(payload: P, path: string, value: unknown): P {
  const keys = parsePath(path);
  const write = (node: unknown, depth: number): unknown => {
    const key = keys[depth];
    const last = depth === keys.length - 1;
    if (Array.isArray(node)) {
      if (typeof key !== "number" || key < 0 || key >= node.length) return node;
      const copy = node.slice();
      copy[key] = last ? value : write(node[key], depth + 1);
      return copy;
    }
    if (node === null || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    if (!(String(key) in record)) return node;
    return { ...record, [key]: last ? value : write(record[String(key)], depth + 1) };
  };
  return write(payload, 0) as P;
}

/** Text (string) field paths the variable picker may insert into, for the editor fallback. */
export function defaultTextPath(type: ContentType): string {
  return type === "FREEFORM" ? "text" : "body";
}

/** Adds an empty 알림톡 button (no-op at the storage cap). */
export function addAlimtalkButton(payload: AlimtalkPayload): AlimtalkPayload {
  if (payload.buttons.length >= MAX_ALIMTALK_BUTTONS_STORED) return payload;
  return { ...payload, buttons: [...payload.buttons, { name: "", link: "" }] };
}

export function removeAlimtalkButton(payload: AlimtalkPayload, index: number): AlimtalkPayload {
  if (index < 0 || index >= payload.buttons.length) return payload;
  return { ...payload, buttons: payload.buttons.filter((_, i) => i !== index) };
}

/** Card count select: keeps the first `count` cards and appends blank ones (clamped to 1–5). */
export function setRcsCardCount(payload: RcsPayload, count: number): RcsPayload {
  const n = Math.max(MIN_RCS_CARDS, Math.min(MAX_RCS_CARDS, Math.trunc(count) || MIN_RCS_CARDS));
  const cards = payload.cards.slice(0, n);
  while (cards.length < n) cards.push({ ...BLANK_CARD });
  return { ...payload, cards };
}
