"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import {
  canEditContentByPolicy,
  invalidateRequestViews,
  performableActions,
  requestApi,
  requestKeys,
  storeContent,
  updateContentFiles,
  type Content,
  type FileMeta,
  type RcsPayload,
  type RequestDetail,
} from "@/entities/request";
import { watchTabClose } from "@/widgets/app-shell";
import { RevisionSession } from "./revision-session";

export const UNSAVED_BEFORE_ASK = "저장하지 않은 수정본이 있습니다. 먼저 저장하거나 취소하세요";
export const UNSAVED_BEFORE_ANSWER = "수정 중인 콘텐츠를 먼저 저장하세요";

/** Toast when the lock answer shows a newer version than the screen (the buffer was dropped). */
export function staleBaseMessage(key: string, version: number): string {
  return `${key}의 최신 버전(v${version})이 저장되어 있어 불러왔습니다. 최신 내용에서 다시 수정하세요`;
}

/** A 수정본 저장 that hit a newer version (reference conflict modal). */
export interface RevisionConflict {
  key: string;
  message: string;
}

export interface RevisionEditing {
  session: RevisionSession;
  /** Review-time editing is allowed now (not a draft, `EDIT_CONTENT`, not the requester's own recall). */
  canEdit: boolean;
  /** Assigned reviewers may upload file revisions while 검수 중. */
  canUploadFileVersions: boolean;
  saving: string | null;
  save: (server: Content) => void;
  discard: (key: string) => void;
  conflict: RevisionConflict | null;
  /** `reload`: drop the buffer and load the latest version (최신 버전 불러오기). */
  resolveConflict: (reload: boolean) => void;
  fileVersionBusy: number | null;
  uploadFileVersion: (server: Content, file: FileMeta, picked: File) => void;
  imageBusy: { key: string; index: number } | null;
  uploadImage: (server: Content, index: number, file: File) => void;
  /** Message blocking a workflow step while a buffer is unsaved (null = free to go). */
  unsavedReason: (step: "ask" | "answer" | "complete") => string | null;
}

const IMAGE_TYPES = ["image/png", "image/jpeg"];

function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Buffer + edit lock editing of a request outside the draft state (reference `mutF` / `saveRev` /
 * `discard`). Locks are released when the tab is closed or the page unloads.
 */
export function useRevisionEditing(
  request: RequestDetail,
  tabId: string,
  meId: number,
  setDirty: (dirty: boolean) => void,
): RevisionEditing {
  const client = useQueryClient();
  const id = request.id;
  const dirtyRef = useRef(setDirty);
  useEffect(() => {
    dirtyRef.current = setDirty;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RevisionConflict | null>(null);
  const [fileVersionBusy, setFileVersionBusy] = useState<number | null>(null);
  const [imageBusy, setImageBusy] = useState<{ key: string; index: number } | null>(null);
  const reload = () => void client.invalidateQueries({ queryKey: requestKeys.detail(id) });

  const [session] = useState(() => {
    const s = new RevisionSession({
      api: {
        lock: (key) => requestApi.lock(id, key),
        release: (key, keepalive) => requestApi.releaseLock(id, key, keepalive),
        save: (key, body) => requestApi.saveRevision(id, key, body),
      },
      onDirty: (dirty) => dirtyRef.current(dirty),
      onLockDenied: (_key, error) => {
        toast(messageOf(error, "편집을 시작하지 못했습니다"));
        void client.invalidateQueries({ queryKey: requestKeys.detail(id) });
      },
      onStaleBase: (key, version) => {
        toast(staleBaseMessage(key, version));
        void client.invalidateQueries({ queryKey: requestKeys.detail(id) });
      },
    });
    if (typeof window !== "undefined") {
      const onHide = () => s.releaseAll(true);
      window.addEventListener("pagehide", onHide);
      watchTabClose(tabId, () => {
        window.removeEventListener("pagehide", onHide);
        s.releaseAll();
      });
    }
    return s;
  });
  useSyncExternalStore(session.subscribe, session.getVersion, session.getVersion);

  const performable = performableActions(request.allowedActions);
  const canEdit = request.status !== "DRAFT" && canEditContentByPolicy(request, meId);
  const fetchedAt = client.getQueryState(requestKeys.detail(id))?.dataUpdatedAt ?? 0;

  // A fresh server copy tells whether my locks still stand (force release, expiry, state change).
  useEffect(() => {
    session.syncServer(request.contents, meId, fetchedAt, canEdit);
  }, [session, request, meId, fetchedAt, canEdit]);

  const afterContent = (content: Content) => {
    storeContent(client, id, content);
    invalidateRequestViews(client, id);
  };

  return {
    session,
    canEdit,
    canUploadFileVersions: canEdit && request.status === "IN_REVIEW" && performable.has("REVIEW"),
    saving,
    save: (server) => {
      if (saving) return;
      setSaving(server.key);
      void session
        .save(server)
        .then((outcome) => {
          switch (outcome.kind) {
            case "saved":
              afterContent(outcome.content);
              toast(
                outcome.changed
                  ? `v${outcome.content.version}을 저장했습니다`
                  : "변경된 내용이 없어 새 버전을 만들지 않았습니다",
              );
              return;
            case "conflict":
              setConflict({ key: server.key, message: outcome.message });
              return;
            case "lockLost":
            case "invalid":
              toast(outcome.message);
              return;
            case "error":
              toast(messageOf(outcome.error, "수정본을 저장하지 못했습니다"));
              if (isApiError(outcome.error) && (outcome.error.status === 403 || outcome.error.code === "REQUEST_STATE_CONFLICT")) {
                reload();
              }
              return;
            case "none":
              return;
          }
        })
        .finally(() => setSaving(null));
    },
    discard: (key) => void session.discard(key),
    conflict,
    resolveConflict: (doReload) => {
      if (doReload && conflict) {
        void session.discard(conflict.key);
        reload();
      }
      setConflict(null);
    },
    fileVersionBusy,
    uploadFileVersion: (server, file, picked) => {
      if (fileVersionBusy !== null) return;
      setFileVersionBusy(file.id);
      void (async () => {
        try {
          if (!(await session.begin(server))) return;
          const meta = await requestApi.uploadFileVersion(id, server.key, file.id, picked);
          updateContentFiles(client, id, server.key, (files) => files.map((f) => (f.id === meta.id ? meta : f)));
          void client.invalidateQueries({ queryKey: requestKeys.history(id) });
          toast(`${meta.name} v${meta.version}을 올렸습니다. 수정본을 저장하면 새 버전에 반영됩니다`);
        } catch (error) {
          toast(messageOf(error, "수정본 파일을 올리지 못했습니다"));
        } finally {
          setFileVersionBusy(null);
        }
      })();
    },
    imageBusy,
    uploadImage: (server, index, file) => {
      if (!IMAGE_TYPES.includes(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
        toast("PNG/JPG 이미지를 선택하세요");
        return;
      }
      setImageBusy({ key: server.key, index });
      void (async () => {
        try {
          if (!(await session.begin(server))) return;
          const { imageKey } = await requestApi.uploadImage(id, server.key, file);
          const payload = session.content(server).payload as RcsPayload;
          session.setPayload(server, { ...payload, cards: payload.cards.map((c, i) => (i === index ? { ...c, imageKey } : c)) });
        } catch (error) {
          toast(messageOf(error, "이미지를 올리지 못했습니다"));
        } finally {
          setImageBusy(null);
        }
      })();
    },
    unsavedReason: (step) => {
      if (!session.hasAny()) return null;
      if (step === "answer") return UNSAVED_BEFORE_ANSWER;
      if (step === "complete") return "저장하지 않은 수정본이 있습니다. 먼저 저장하세요";
      return UNSAVED_BEFORE_ASK;
    },
  };
}
