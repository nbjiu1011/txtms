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
