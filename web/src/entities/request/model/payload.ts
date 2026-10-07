import type {
  AlimtalkPayload,
  ContentPayload,
  ContentPayloadByType,
  ContentType,
  FreeformPayload,
  RcsPayload,
  SmsPayload,
} from "./types";

/** Narrows a payload with the request type (the payload shape follows the request type). */
export function payloadAs<T extends ContentType>(_type: T, payload: ContentPayload): ContentPayloadByType[T] {
  return payload as ContentPayloadByType[T];
}

/** Fills missing keys so read-only rendering never meets `undefined`. */
export function normalizePayload(type: ContentType, payload: ContentPayload | null | undefined): ContentPayload {
  const p = (payload ?? {}) as Partial<AlimtalkPayload & SmsPayload & RcsPayload & FreeformPayload>;
  switch (type) {
    case "ALIMTALK":
      return { templateCode: p.templateCode ?? "", body: p.body ?? "", buttons: p.buttons ?? [] };
    case "SMS":
      return { sender: p.sender ?? "", body: p.body ?? "", customerCenter: !!p.customerCenter, optOut: !!p.optOut };
    case "RCS":
      return {
        cards: (p.cards ?? []).map((c) => ({
          title: c.title ?? "",
          body: c.body ?? "",
          imageKey: c.imageKey ?? null,
          imageAlt: c.imageAlt ?? "",
          buttonName: c.buttonName ?? "",
          buttonLink: c.buttonLink ?? "",
        })),
      };
    case "FREEFORM":
      return { title: p.title ?? "", text: p.text ?? "" };
  }
}

/** Text fields of a payload as `[path, value]` (contract correction paths; reference `textFields`). */
export function textFields(type: ContentType, payload: ContentPayload): [string, string][] {
  const p = normalizePayload(type, payload);
  switch (type) {
    case "ALIMTALK": {
      const a = p as AlimtalkPayload;
      return [["body", a.body], ...a.buttons.map((b, i): [string, string] => [`buttons.${i}.name`, b.name])];
    }
    case "SMS":
      return [["body", (p as SmsPayload).body]];
    case "RCS":
      return (p as RcsPayload).cards.flatMap((c, i): [string, string][] => [
        [`cards.${i}.title`, c.title],
        [`cards.${i}.body`, c.body],
      ]);
    case "FREEFORM": {
      const f = p as FreeformPayload;
      return [
        ["title", f.title],
        ["text", f.text],
      ];
    }
  }
}

export type TextSegment = { kind: "text"; text: string } | { kind: "var"; key: string };

const VARIABLE_TOKEN = /#\{([^}]*)\}/g;

/**
 * Splits text into plain parts and `#{key}` variable tokens. Known variables are replaced by their
 * values (plain text); unknown ones stay tokens (rendered as chips).
 */
export function segmentVariables(text: string, values?: ReadonlyMap<string, string>): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else out.push({ kind: "text", text: t });
  };
  for (const match of text.matchAll(VARIABLE_TOKEN)) {
    const start = match.index ?? 0;
    push(text.slice(last, start));
    const key = match[1];
    const value = values?.get(key);
    if (value !== undefined) push(value);
    else out.push({ kind: "var", key });
    last = start + match[0].length;
  }
  push(text.slice(last));
  return out;
}

/** Replaces known `#{key}` tokens with their values (unknown tokens are kept). */
export function resolveVariables(text: string, values?: ReadonlyMap<string, string>): string {
  return segmentVariables(text, values)
    .map((s) => (s.kind === "text" ? s.text : `#{${s.key}}`))
    .join("");
}
