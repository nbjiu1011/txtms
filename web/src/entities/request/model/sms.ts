import type { SmsPayload } from "./types";

/** Customer-center line appended to an SMS when `customerCenter` is on (contract §3.4). */
export const SMS_CUSTOMER_CENTER_LINE = "\n고객센터 1588-0000";
/** Opt-out line appended to an SMS when `optOut` is on (contract §3.4). */
export const SMS_OPT_OUT_LINE = "\n무료 수신거부 080-000-0000";
/** Up to this many bytes the message is a short SMS; above it is LMS. */
export const SMS_SHORT_MAX_BYTES = 90;
/** Submission limit (bytes, notices included). */
export const SMS_MAX_BYTES = 2000;

/** Byte length: code points above 127 count 2, the rest 1. */
export function textBytes(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += (ch.codePointAt(0) ?? 0) > 127 ? 2 : 1;
  return bytes;
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

export function isShortSms(bytes: number): boolean {
  return bytes <= SMS_SHORT_MAX_BYTES;
}
