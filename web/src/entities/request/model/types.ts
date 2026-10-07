/**
 * Request domain types — the same shapes the API returns (keys and enums must match the server).
 * Keys are the contract keys; do not rename.
 */
import type { VariableType } from "@/entities/variable/@x/request";

export const REQUEST_STATUSES = [
  "DRAFT",
  "WAITING",
  "IN_REVIEW",
  "CONFIRMING",
  "APPROVAL_WAITING",
  "REVIEW_COMPLETED",
  "APPROVED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CONTENT_TYPES = ["ALIMTALK", "SMS", "RCS", "FREEFORM"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const URGENCIES = ["NORMAL", "URGENT"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const FILE_SCAN_STATUSES = ["PENDING", "SAFE", "FAILED", "UNSAFE"] as const;
export type FileScanStatus = (typeof FILE_SCAN_STATUSES)[number];

export const FILE_UNITS = ["PAGE", "ROW", "SLIDE", "LINE", "IMAGE"] as const;
export type FileUnit = (typeof FILE_UNITS)[number];

export const REQUEST_ACTIONS = [
  "EDIT_REQUEST",
  "EDIT_CONTENT",
  "SUBMIT",
  "CANCEL",
  "RECALL",
  "DECIDE_RECALL",
  "ANSWER",
  "ASSIGN",
  "CHANGE_ASSIGNMENT",
  "EDIT_DUE",
  "REVIEW",
  "COMPLETE",
  "APPROVE",
  "REVISE",
  "CLONE",
  "FOLLOW_UP",
  "UNLOCK",
  "EXPORT",
] as const;
export type RequestAction = (typeof REQUEST_ACTIONS)[number];

/** Final states (completion bundle exists). */
export const FINAL_STATUSES: readonly RequestStatus[] = ["REVIEW_COMPLETED", "APPROVED"];

export interface FileAmount {
  unit: FileUnit;
  amount: number;
}

export interface RequestVolume {
  chars: number;
  files: FileAmount[];
}

/** Content key and title as listed in summaries (`contents` of RequestSummary). */
export interface ContentRef {
  key: string;
  title: string;
}

export interface RequestSummary {
  id: string;
  projectId: number;
  type: ContentType;
  title: string;
  status: RequestStatus;
  round: number;
  requesterId: number;
  reviewerIds: number[];
  primaryReviewerId: number | null;
  leadUserId: number | null;
  hopeDueDate: string | null;
  dueDate: string | null;
  urgency: Urgency;
  submittedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  recallRequested: boolean;
  parentRequestId: string | null;
  campaign: string | null;
  dueSoon: boolean;
  overdue: boolean;
  contentCount: number;
  contentVersions: number[];
  /** Keys and titles of the current contents (detail narrows this to full `Content`). */
  contents: ContentRef[];
  volume: RequestVolume;
}

/* ---------- content payloads (§3.4) ---------- */

export interface AlimtalkButton {
  name: string;
  link: string;
}

export interface AlimtalkPayload {
  templateCode: string;
  body: string;
  buttons: AlimtalkButton[];
}

export interface SmsPayload {
  sender: string;
  body: string;
  customerCenter: boolean;
  optOut: boolean;
}

export interface RcsCard {
  title: string;
  body: string;
  imageKey: string | null;
  imageAlt: string;
  buttonName: string;
  buttonLink: string;
}

export interface RcsPayload {
  cards: RcsCard[];
}

export interface FreeformPayload {
  title: string;
  text: string;
}

export interface ContentPayloadByType {
  ALIMTALK: AlimtalkPayload;
  SMS: SmsPayload;
  RCS: RcsPayload;
  FREEFORM: FreeformPayload;
}

/** Union of payload shapes; narrow with the request `type`. */
export type ContentPayload = ContentPayloadByType[ContentType];

/* ---------- files (§3.5) ---------- */

export interface FileVersionMeta {
  version: number;
  name: string;
  createdAt: string;
  createdBy: number;
  sizeBytes: number;
}

export interface FileMeta {
  id: number;
  name: string;
  ext: string;
  unit: FileUnit;
  sizeBytes: number;
  /** null until entered (the range rule is checked on submit). */
  totalAmount: number | null;
  reviewAmount: number | null;
  rangeNote: string | null;
  version: number;
  scanStatus: FileScanStatus;
  versions: FileVersionMeta[];
}

/* ---------- content (§3.3) ---------- */

export interface ContentLock {
  userId: number;
  lockedAt: string;
  expiresAt: string;
}

export interface ContentVersionRef {
  version: number;
  createdAt: string;
  createdBy: number;
}

export interface Content {
  key: string;
  title: string;
  version: number;
  payload: ContentPayload;
  files: FileMeta[];
  lock: ContentLock | null;
  savedAt: string | null;
  versions: ContentVersionRef[];
}

export interface ContentVersion {
  version: number;
  title: string;
  payload: ContentPayload;
  files: FileMeta[];
  createdAt: string;
  createdBy: number;
}

/* ---------- completion bundle (§3.6) ---------- */

export interface BundleVariable {
  key: string;
  type: VariableType;
  value: string;
}

export interface BundleItem {
  contentKey: string;
  title: string;
  version: number;
  payload: ContentPayload;
  files: FileMeta[];
}

export interface CompletionBundle {
  status: FinalStatus;
  completedAt: string;
  completedBy: number;
  variables: BundleVariable[];
  items: BundleItem[];
}

/* ---------- request detail (§3.2) ---------- */

export interface RecallInfo {
  requestedBy: number;
  requestedAt: string;
  reason: string;
}

export interface ParentRef {
  requestId: string;
  contentKey: string | null;
}

export interface Opinion {
  id: number;
  authorId: number;
  /** null = 요청 전체. */
  contentKey: string | null;
  body: string;
  round: number;
  createdAt: string;
}

export interface Ask {
  id: number;
  askedBy: number;
  /** null = 요청 전체. */
  contentKey: string | null;
  question: string;
  askedAt: string;
  answer: string | null;
  answeredBy: number | null;
  answeredAt: string | null;
  round: number;
}

/** One reviewer of the "공동 검수 결과" (current assignment first, then earlier opinion authors). */
export interface CoReviewer {
  userId: number;
  /** Currently assigned (false = 이전 담당 who left opinions). */
  current: boolean;
  /** Current primary reviewer. */
  primary: boolean;
  opinionCount: number;
  /** Rounds with opinions only, ascending. */
  rounds: { round: number; count: number }[];
}

export interface StageTimes {
  DRAFT: string | null;
  WAITING: string | null;
  IN_REVIEW: string | null;
  COMPLETED: string | null;
  APPROVED: string | null;
}

export interface RequestDetail extends RequestSummary {
  /** null until entered (PATCH with null clears a value). */
  purpose: string | null;
  target: string | null;
  background: string | null;
  recall: RecallInfo | null;
  parent: ParentRef | null;
  contents: Content[];
  opinions: Opinion[];
  asks: Ask[];
  eligibleApproverIds: number[];
  coReviewers: CoReviewer[];
  historyCount: number;
  stageTimes: StageTimes;
  bundle: CompletionBundle | null;
  allowedActions: RequestAction[];
  rowVersion: number;
  /**
   * Round a submit would get now (`round + 1` after an approved recall). Newer servers only; absent
   * means unknown.
   */
  nextSubmitRound?: number;
}

/** Editable request info keys (PATCH /api/requests/{id}). */
export type RequestInfoPatch = Partial<
  Pick<RequestDetail, "title" | "hopeDueDate" | "purpose" | "target" | "background" | "campaign" | "urgency">
>;

/* ---------- write bodies (§3.7, §4, §5) ---------- */

/** `POST /api/requests`. */
export interface RequestCreate {
  projectId: number;
  /** Omitted: the first active type. */
  type?: ContentType;
}

/** `PUT /api/requests/{id}/contents/{key}` — draft autosave. */
export interface ContentSave {
  title: string;
  payload: ContentPayload;
  /** `savedAt` the client last loaded; a newer server save is a `VERSION_CONFLICT`. */
  expectedSavedAt?: string | null;
}

/** `POST /api/requests/{id}/submit-check` — submit validation without a state change. */
export interface SubmitCheck {
  ok: boolean;
  details: string[];
  fieldErrors: { field: string; message: string }[];
}

/** Body keys of the workflow POSTs (§5); `rowVersion` is added by the API call. */
export interface AssignBody {
  reviewerIds: number[];
  primaryReviewerId: number | null;
  /** KST date `YYYY-MM-DD`. */
  dueDate: string;
  urgency: Urgency | null;
}

export interface ChangeAssignmentBody {
  reviewerIds: number[];
  primaryReviewerId: number | null;
  reason: string;
  handover: string;
}

export interface ScheduleBody {
  dueDate: string;
  urgency: Urgency | null;
  reason: string;
}

export interface ReviseBody {
  reason: string;
  expectation: string;
  contentKey: string;
  /** Detailed location (optional). */
  location: string | null;
}

/** Amounts of one current attachment sent with a revision (`files` of `POST …/revisions`). */
export interface RevisionFileAmount {
  fileId: number;
  totalAmount: number | null;
  reviewAmount: number | null;
  rangeNote: string | null;
}

/** `POST /api/requests/{id}/contents/{key}/revisions` — review-time revision (edit lock held). */
export interface RevisionSave {
  baseVersion: number;
  title?: string;
  payload: ContentPayload;
  files?: RevisionFileAmount[];
}

/** Structured record of a 검수자 변경 (§3.7). */
export interface AssignmentChange {
  at: string;
  actorId: number;
  round: number;
  fromReviewerIds: number[];
  fromPrimaryId: number | null;
  toReviewerIds: number[];
  toPrimaryId: number | null;
  reason: string;
  handover: string;
}

/** `PATCH .../files/{fileId}` — review range of an attachment. */
export type FileRangePatch = Pick<FileMeta, "totalAmount" | "reviewAmount" | "rangeNote">;

/** Row of `POST /api/requests/{id}/bulk-import/commit`. */
export type BulkCommitRow = Pick<BulkImportRow, "title" | "payload">;

/* ---------- history (§3.7) ---------- */

export interface HistoryEntry {
  id: number;
  at: string;
  actorId: number;
  /** Korean business action name, displayed as is. */
  action: string;
  detail: string | null;
  contentKey: string | null;
  contentTitle: string | null;
  round: number;
}

/* ---------- list views (§3.8) ---------- */

export const REQUEST_LIST_VIEWS = [
  "MY_DRAFT",
  "MY_CONFIRMING",
  "MY_IN_PROGRESS",
  "MY_REVIEW",
  "RECALL_PENDING",
  "WAITING_ASSIGNMENT",
  "OVERDUE",
  "DUE_SOON",
  "APPROVAL_PENDING",
  "CUSTOMER_IN_PROGRESS",
  "CUSTOMER_COMPLETED",
  "MY_ASSIGNED_ACTIVE",
  "MY_ASSIGNED_DONE",
  "APPROVAL_QUEUE",
  "APPROVAL_PROCESSED",
] as const;
export type RequestListView = (typeof REQUEST_LIST_VIEWS)[number];

export interface RequestListParams {
  projectId?: number;
  customerId?: number;
  q?: string;
  type?: ContentType;
  status?: RequestStatus;
  primaryReviewerId?: number;
  reviewerId?: number;
  leadUserId?: number;
  dueFrom?: string;
  dueTo?: string;
  submittedFrom?: string;
  submittedTo?: string;
  mine?: boolean;
  view?: RequestListView;
  page?: number;
  size?: number;
}

/* ---------- archive (§8) ---------- */

/** Final statuses a completed content can have (archive status filter). */
export type FinalStatus = Extract<RequestStatus, "REVIEW_COMPLETED" | "APPROVED">;

/** `GET /api/archive/contents` query (filters apply to the latest completed version of a line). */
export interface ArchiveListParams {
  projectId: number;
  q?: string;
  type?: ContentType;
  campaign?: string;
  status?: FinalStatus;
  /** KST date `YYYY-MM-DD`, both ends inclusive. */
  completedFrom?: string;
  completedTo?: string;
  page?: number;
  size?: number;
}

export interface ArchiveLatest {
  requestId: string;
  contentKey: string;
  title: string;
  version: number;
  type: ContentType;
  status: RequestStatus;
  completedAt: string;
  campaign: string | null;
  preview: string;
  fileNames: string[];
  resolvedText: string;
}

export interface ArchivePast {
  requestId: string;
  contentKey: string;
  title: string;
  version: number;
  completedAt: string;
}

export interface ArchiveFollowUp {
  requestId: string;
  status: RequestStatus;
  title: string;
}

export interface ArchiveLine {
  lineKey: string;
  latest: ArchiveLatest;
  past: ArchivePast[];
  followUps: ArchiveFollowUp[];
  campaigns: string[];
}

/* ---------- bulk import (§4) ---------- */

export interface BulkImportRow {
  rowNumber: number;
  title: string;
  payload: ContentPayload;
  errors: string[];
}

export interface BulkImportPreview {
  rows: BulkImportRow[];
  limit: number;
}

/* ---------- content types & guides (§2) ---------- */

export interface ContentTypeSetting {
  type: ContentType;
  active: boolean;
  mockEnabled: boolean;
}

export interface WritingGuide {
  type: ContentType;
  principles: string;
  goodExpressions: { avoid: string; prefer: string }[];
  checklist: string[];
}
