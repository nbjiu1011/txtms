import { FILE_UNIT_LABEL } from "./labels";
import type { RequestVolume } from "./types";

/**
 * 검수량 text of a request (reference `volume`): text characters (`1,240자`, contents without
 * attachments) then the review range per file unit (`페이지 6`). Units are never added together.
 */
export function formatVolume(volume: RequestVolume): string {
  const parts: string[] = [];
  if (volume.chars) parts.push(`${volume.chars.toLocaleString("ko-KR")}자`);
  for (const f of volume.files) parts.push(`${FILE_UNIT_LABEL[f.unit]} ${f.amount}`);
  return parts.join(", ");
}
