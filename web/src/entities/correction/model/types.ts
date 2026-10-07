import type { ContentPayload } from "@/entities/request/@x/correction";

/** Text correction results — contract §6. */
export interface CorrectionOption {
  ruleId: string;
  /** null when the rule only explains (no replacement). */
  recommended: string | null;
  descriptionLabel: string;
  description: string;
}

export interface CorrectionGroup {
  /** `{field}:{start}:{end}` */
  id: string;
  /** Payload path: `body`, `buttons.0.name`, `cards.1.body`, `text`, `title`. */
  field: string;
  start: number;
  end: number;
  matchedText: string;
  options: CorrectionOption[];
}

export interface CorrectionResult {
  contentKey: string;
  checkedAt: string;
  datasetLabel: string;
  variablesRevision: number;
  /** true for a free-form content with attachments (not checked). */
  excluded: boolean;
  groups: CorrectionGroup[];
}

export type CorrectionEventAction = "APPLY" | "RESTORE";

/** `GET /api/requests/{id}/corrections/dataset` — the effective dataset of the request's customer × type. */
export interface CorrectionDataset {
  assigned: boolean;
  /** `{유형 라벨} v{버전}`; null when unassigned. */
  datasetLabel: string | null;
}

/** One content of `POST …/corrections/check` (the edit buffer as shown). */
export interface CorrectionCheckItem {
  contentKey: string;
  payload: ContentPayload;
  hasFiles: boolean;
}

/** `POST …/corrections/events` — history only; the text change happens in the edit buffer. */
export interface CorrectionEvent {
  contentKey: string;
  action: CorrectionEventAction;
  field: string;
  before: string;
  after: string;
  /** Rule applied (or restored); the history detail gets `({ruleId})` (contract §14.4). */
  ruleId?: string;
}

/** `POST …/corrections/suggestions` (화면설계 ④ 건의하기). */
export interface CorrectionSuggestion {
  contentKey: string;
  matchedText: string;
  ruleIds: string[];
  body: string;
  /** Optional 제안 표현 (max 200, contract §14.4). */
  suggestedExpr?: string;
}
