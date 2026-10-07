import { toast } from "@/shared/ui";
import { requestApi } from "@/entities/request";

export const COPY_DONE = "문안을 복사했습니다";
export const COPY_FAILED = "복사하지 못했습니다. 직접 선택해 복사하세요";

export interface CopyTarget {
  requestId: string;
  contentKey: string;
  /** Text to put on the clipboard (variables already replaced by completion-time values). */
  text: string;
}

/**
 * 복사 of a completed content: writes the text to the clipboard (in the click, before any network
 * call, so the browser keeps the user gesture), shows the reference toast and records the export
 * audit (`POST …/bundle/copy-events`). The copy has already happened when the audit call runs, so an
 * audit failure does not turn it into an error for the user. Resolves whether the text was copied.
 */
export async function copyCompletedText(target: CopyTarget): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(target.text);
  } catch {
    toast(COPY_FAILED);
    return false;
  }
  toast(COPY_DONE);
  try {
    await requestApi.copyEvent(target.requestId, target.contentKey);
  } catch (error) {
    console.warn("[txtms] copy audit event was not recorded", error);
  }
  return true;
}
