import { formatDateTime } from "@/shared/lib";
import type { AutosaveSnapshot } from "./autosave";

/** Autosave indicator text (reference `.save-ind`). */
export function saveLabel(state: AutosaveSnapshot): string {
  switch (state.status) {
    case "saving":
      return "저장 중";
    case "saved":
      return `저장됨 ${formatDateTime(state.savedAt)}`;
    case "fail":
      return "저장 실패. 연결을 확인한 뒤 다시 저장하세요";
    default:
      return "자동 저장 켜짐";
  }
}
