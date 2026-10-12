import { resolveVariables } from "./payload";
import { smsFullText, textBytes, textChars, unsupportedChars } from "./sms";
import type { AlimtalkPayload, ChannelSpec, SmsPayload } from "./types";

/**
 * Channel spec checks of the editor counters (§17.3). They only ever warn. Each length is measured on
 * the stored text (`raw`, as the server counts) and with the current variable values applied
 * (`expected`, unknown `#{key}` tokens kept); a limit counts as exceeded when either is above it.
 */

/** Disclaimer shown once next to the counters. */
export const CHANNEL_SPEC_NOTICE =
  "채널 규격 안내는 작성·검수 지원용이며 발송 가능 여부나 외부 심사 통과를 보증하지 않습니다";

export interface Measure {
  raw: number;
  expected: number;
  /** The text has `#{key}` tokens, so `expected` may differ from `raw`. */
  hasVariables: boolean;
}

const TOKEN = /#\{[^}]*\}/;

function measure(text: string, values: ReadonlyMap<string, string> | undefined, count: (t: string) => number): Measure {
  const hasVariables = TOKEN.test(text);
  const raw = count(text);
  return { raw, expected: hasVariables ? count(resolveVariables(text, values)) : raw, hasVariables };
}

/** Larger of the stored and the variable-applied length. */
export function peak(m: Measure): number {
  return Math.max(m.raw, m.expected);
}

export interface AlimtalkCheck {
  body: Measure;
  bodyOver: boolean;
  buttonsOver: boolean;
  /** Per button: name longer than the spec. */
  longNames: boolean[];
}

/** Counts always; the over flags stay false until the spec is known (`null` while loading). */
export function checkAlimtalk(
  payload: Pick<AlimtalkPayload, "body" | "buttons">,
  spec: ChannelSpec["alimtalk"] | null,
  values?: ReadonlyMap<string, string>,
): AlimtalkCheck {
  const body = measure(payload.body, values, textChars);
  return {
    body,
    bodyOver: !!spec && peak(body) > spec.bodyMaxChars,
    buttonsOver: !!spec && payload.buttons.length > spec.buttonsMax,
    longNames: payload.buttons.map((b) => !!spec && textChars(b.name) > spec.buttonNameMaxChars),
  };
}

/** `SMS` up to the short limit, `LMS` above it (an expected conversion only), `OVER` above the LMS limit. */
export type SmsKind = "SMS" | "LMS" | "OVER";

export interface SmsCheck {
  /** Bytes of body + notice lines. */
  bytes: Measure;
  /** `null` until the spec is known. */
  kind: SmsKind | null;
  /** Characters EUC-KR cannot represent (counted 2 bytes). */
  unsupported: string[];
}

export function smsKind(bytes: number, spec: ChannelSpec["sms"]): SmsKind {
  if (bytes > spec.lmsMaxBytes) return "OVER";
  return bytes > spec.smsMaxBytes ? "LMS" : "SMS";
}

export function checkSms(
  payload: Pick<SmsPayload, "body" | "customerCenter" | "optOut">,
  spec: ChannelSpec["sms"] | null,
  values?: ReadonlyMap<string, string>,
): SmsCheck {
  const text = smsFullText(payload);
  const bytes = measure(text, values, textBytes);
  return {
    bytes,
    kind: spec ? smsKind(peak(bytes), spec) : null,
    unsupported: unsupportedChars(bytes.hasVariables ? resolveVariables(text, values) : text),
  };
}

/** `1,000` style number for the counters and warnings. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
