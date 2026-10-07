"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError, type FieldError } from "@/shared/api";
import { toast } from "@/shared/ui";
import {
  DEMO_SCAN_HEADER,
  performableActions,
  removeContent,
  requestApi,
  requestKeys,
  storeContent,
  storeRequestDetail,
  invalidateRequestViews,
  updateContentFiles,
  type Content,
  type ContentType,
  type FileMeta,
  type RcsPayload,
  type RequestDetail,
} from "@/entities/request";
import { isRetriableSaveError, type DraftSession } from "./draft-session";
import { uploadAll, type UploadItem } from "./upload-queue";
import { useDraftSession } from "./use-draft-session";

/** Demo-only scan outcome (sent as a header; the server ignores it outside demo mode). */
export type ScanOutcome = "SAFE" | "FAILED" | "UNSAFE";

export const SAVE_RETRY_FAILED = "저장 실패: 3회 재시도했습니다. 수동 저장을 실행하세요.";
export const UPLOAD_BUSY_MESSAGE = "첨부파일 업로드·검사가 끝난 후 요청하세요";
const IMAGE_TYPES = ["image/png", "image/jpeg"];

export interface DraftEditing {
  session: DraftSession;
  /** Draft request info, content list (add/delete/bulk) and type are editable. */
  canEditRequest: boolean;
  /** Draft content fields are editable (autosave). */
  canEditContent: boolean;
  /** Message of the last failed save (shown while the save state is `fail`). */
  saveError: string | null;
  /** Content whose save hit a newer save elsewhere (`null` = request info); undefined = none. */
  conflict: string | null | undefined;
  resolveConflict: (reload: boolean) => void;
  infoErrors: Readonly<Record<string, string>>;
  setFieldErrors: (errors: FieldError[]) => void;
  clearInfoError: (field: string) => void;
  addContent: () => Promise<string | null>;
  deleteContent: (key: string) => Promise<boolean>;
  changeType: (type: ContentType) => Promise<boolean>;
  uploads: UploadItem[];
  uploadBusy: boolean;
  uploadFiles: (content: Content, files: File[]) => void;
  deleteFile: (content: Content, file: FileMeta) => void;
  imageBusy: { key: string; index: number } | null;
  uploadImage: (content: Content, index: number, file: File) => void;
  scanOutcome: ScanOutcome;
  setScanOutcome: (outcome: ScanOutcome) => void;
  /** Reloads the request from the server. */
  reload: () => void;
}

function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

/** Everything a draft request tab needs to edit: session, list actions, uploads, error state. */
export function useDraftEditing(request: RequestDetail, tabId: string, setDirty: (dirty: boolean) => void): DraftEditing {
  const client = useQueryClient();
  const id = request.id;
  const performable = performableActions(request.allowedActions);
  const draft = request.status === "DRAFT";
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null | undefined>(undefined);
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<{ key: string; index: number } | null>(null);
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome>("SAFE");
  const uploadSeq = useRef(0);

  const reload = () => void client.invalidateQueries({ queryKey: requestKeys.detail(id) });
  const setFieldErrors = (errors: FieldError[]) =>
    setInfoErrors(Object.fromEntries(errors.map((e) => [e.field, e.message])));

  const session = useDraftSession({
    requestId: id,
    tabId,
    setDirty,
    onError: (error, key) => {
      if (isApiError(error) && error.code === "VERSION_CONFLICT") {
        setSaveError(error.message);
        setConflict(key);
        return;
      }
      if (isRetriableSaveError(error)) {
        setSaveError(SAVE_RETRY_FAILED);
        return;
      }
      if (isApiError(error) && (error.code === "REQUEST_STATE_CONFLICT" || error.status === 403 || error.status === 404)) {
        toast(error.message);
        setSaveError(error.message);
        reload();
        return;
      }
      if (isApiError(error) && key === null && error.fieldErrors.length) setFieldErrors(error.fieldErrors);
      setSaveError(messageOf(error, "저장하지 못했습니다"));
    },
  });

  const scanHeaders = (): Record<string, string> =>
    scanOutcome === "SAFE" ? {} : { [DEMO_SCAN_HEADER]: scanOutcome };

  return {
    session,
    canEditRequest: draft && performable.has("EDIT_REQUEST"),
    canEditContent: draft && performable.has("EDIT_CONTENT"),
    saveError,
    conflict,
    resolveConflict: (doReload) => {
      if (doReload) {
        if (conflict) session.discardContent(conflict);
        reload();
        // Settles the indicator (nothing of the conflicting edit is pending any more).
        void session.flush();
      }
      setConflict(undefined);
    },
    infoErrors,
    setFieldErrors,
    clearInfoError: (field) =>
      setInfoErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }),

    addContent: async () => {
      try {
        const content = await requestApi.addContent(id);
        storeContent(client, id, content);
        return content.key;
      } catch (error) {
        toast(messageOf(error, "콘텐츠를 추가하지 못했습니다"));
        return null;
      }
    },
    deleteContent: async (key) => {
      try {
        await requestApi.deleteContent(id, key);
        session.discardContent(key);
        removeContent(client, id, key);
        return true;
      } catch (error) {
        toast(messageOf(error, "콘텐츠를 삭제하지 못했습니다"));
        return false;
      }
    },
    changeType: async (type) => {
      try {
        session.discardContents();
        const detail = await requestApi.changeType(id, type);
        storeRequestDetail(client, detail);
        invalidateRequestViews(client, id);
        return true;
      } catch (error) {
        toast(messageOf(error, "유형을 바꾸지 못했습니다"));
        reload();
        return false;
      }
    },

    uploads,
    uploadBusy,
    uploadFiles: (content, files) => {
      if (uploadBusy) return;
      setUploadBusy(true);
      setUploads([]);
      const headers = scanHeaders();
      void uploadAll(files, {
        nextId: () => ++uploadSeq.current,
        upload: (file, onSent) => requestApi.uploadFile(id, content.key, file, { headers, onSent }),
        onItem: (item) => setUploads((prev) => [...prev.filter((p) => p.id !== item.id), item].sort((a, b) => a.id - b.id)),
        onUploaded: (meta) => updateContentFiles(client, id, content.key, (list) => [...list, meta]),
      }).then((items) => {
        setUploadBusy(false);
        void client.invalidateQueries({ queryKey: requestKeys.history(id) });
        const failed = items.filter((i) => i.error);
        if (failed.length === 0) toast("파일 업로드 완료");
        else toast(failed.length === 1 ? (failed[0].error ?? "") : `${failed.length}개 파일을 등록하지 못했습니다`);
      });
    },
    deleteFile: (content, file) => {
      void requestApi
        .deleteFile(id, content.key, file.id)
        .then(() => {
          session.discardFile(file.id);
          const left = content.files.filter((f) => f.id !== file.id);
          updateContentFiles(client, id, content.key, (list) => list.filter((f) => f.id !== file.id));
          if (left.length === 0) toast("첨부파일이 없어 텍스트 교정을 다시 쓸 수 있습니다");
        })
        .catch((error: unknown) => toast(messageOf(error, "파일을 삭제하지 못했습니다")));
    },

    imageBusy,
    uploadImage: (content, index, file) => {
      if (!IMAGE_TYPES.includes(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
        toast("PNG/JPG 이미지를 선택하세요");
        return;
      }
      setImageBusy({ key: content.key, index });
      void requestApi
        .uploadImage(id, content.key, file, { headers: scanHeaders() })
        .then(({ imageKey }) => {
          const current = session.content(content);
          const payload = current.payload as RcsPayload;
          const cards = payload.cards.map((c, i) => (i === index ? { ...c, imageKey } : c));
          session.setPayload(content, { ...payload, cards });
        })
        .catch((error: unknown) => toast(messageOf(error, "이미지를 올리지 못했습니다")))
        .finally(() => setImageBusy(null));
    },
    scanOutcome,
    setScanOutcome,
    reload,
  };
}
