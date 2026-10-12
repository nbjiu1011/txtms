import type { SmsPayload } from "./types";

/** Customer-center line appended to an SMS when `customerCenter` is on (contract §3.4). */
export const SMS_CUSTOMER_CENTER_LINE = "\n고객센터 1588-0000";
/** Opt-out line appended to an SMS when `optOut` is on (contract §3.4). */
export const SMS_OPT_OUT_LINE = "\n무료 수신거부 080-000-0000";

/**
 * Characters added to KS X 1001 in 1998/2002 (€ ® ㉾ at 0xA2E6–0xA2E8). Browsers decode them, some
 * ICU builds (Node) do not; the server (Java EUC-KR) encodes them, so they are always included.
 */
const KS_X_1001_ADDITIONS = [0x20ac, 0x00ae, 0x327e];

let eucKr: ReadonlySet<number> | null | undefined;

/**
 * Code points (above ASCII) representable in EUC-KR = KS X 1001: every two-byte sequence with lead and
 * trail bytes in 0xA1–0xFE decoded once. Browsers implement "euc-kr" as windows-949, so the extended
 * 0x81–0xA0 ranges are deliberately not decoded. User-defined rows decode to the private use area
 * in some decoders and are excluded. `null` when the runtime has no EUC-KR decoder.
 */
function eucKrSet(): ReadonlySet<number> | null {
  if (eucKr !== undefined) return eucKr;
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder("euc-kr");
  } catch {
    eucKr = null;
    return eucKr;
  }
  const set = new Set<number>(KS_X_1001_ADDITIONS);
  const pair = new Uint8Array(2);
  for (let lead = 0xa1; lead <= 0xfe; lead++) {
    for (let trail = 0xa1; trail <= 0xfe; trail++) {
      pair[0] = lead;
      pair[1] = trail;
      const s = decoder.decode(pair);
      const cp = s.codePointAt(0) ?? 0xfffd;
      if (s.length === 1 && cp !== 0xfffd && cp >= 0x80 && !(cp >= 0xe000 && cp <= 0xf8ff)) set.add(cp);
    }
  }
  eucKr = set;
  return eucKr;
}

/** Whether EUC-KR can represent the code point (ASCII always; unknown runtime support counts as yes). */
export function eucKrEncodable(codePoint: number): boolean {
  if (codePoint < 0x80) return true;
  const set = eucKrSet();
  return set === null || set.has(codePoint);
}

/** Character count: Unicode code points, spaces and line breaks included. */
export function textChars(text: string): number {
  return Array.from(text).length;
}

/** EUC-KR byte length: ASCII 1, any other code point 2 (unsupported characters too). */
export function textBytes(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += (ch.codePointAt(0) ?? 0) < 0x80 ? 1 : 2;
  return bytes;
}

/** Distinct characters EUC-KR cannot represent, in order of first appearance. */
export function unsupportedChars(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) if (!eucKrEncodable(ch.codePointAt(0) ?? 0)) out.add(ch);
  return [...out];
}

/** Text actually sent: body plus the enabled notice lines. */
export function smsFullText(payload: Pick<SmsPayload, "body" | "customerCenter" | "optOut">): string {
  return (
    (payload.body ?? "") +
    (payload.customerCenter ? SMS_CUSTOMER_CENTER_LINE : "") +
    (payload.optOut ? SMS_OPT_OUT_LINE : "")
  );
}

/** Bytes of the SMS including notices (`smsBytes` of the contract). */
export function smsBytes(payload: Pick<SmsPayload, "body" | "customerCenter" | "optOut">): number {
  return textBytes(smsFullText(payload));
}
