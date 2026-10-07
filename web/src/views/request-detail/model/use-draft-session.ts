"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  requestApi,
  requestKeys,
  storeContent,
  storeRequestDetail,
  updateContentFiles,
  invalidateRequestViews,
  type RequestDetail,
} from "@/entities/request";
import { isTabOpen } from "@/widgets/app-shell";
import { DraftSession } from "./draft-session";

export interface DraftSessionOptions {
  requestId: string;
  tabId: string;
  setDirty: (dirty: boolean) => void;
  /** Final save failure; `contentKey` is null for request info. */
  onError: (error: unknown, contentKey: string | null) => void;
}

/**
 * Draft editing session of one work tab. It lives as long as the view state (hidden tabs keep it,
 * so a tab switch never loses a pending save) and stops once its tab is closed.
 */
export function useDraftSession({ requestId, tabId, setDirty, onError }: DraftSessionOptions): DraftSession {
  const client = useQueryClient();
  const handlers = useRef({ setDirty, onError });
  useLayoutEffect(() => {
    handlers.current = { setDirty, onError };
  });

  const [session] = useState(
    () =>
      new DraftSession({
        api: {
          patchInfo: (patch) => requestApi.patchInfo(requestId, patch),
          saveContent: (key, body) => requestApi.saveContent(requestId, key, body),
          patchFile: (key, fileId, body) => requestApi.patchFile(requestId, key, fileId, body),
        },
        server: () => client.getQueryData<RequestDetail>(requestKeys.detail(requestId)),
        onDetail: (detail) => {
          storeRequestDetail(client, detail);
          invalidateRequestViews(client, requestId);
        },
        onContent: (content) => storeContent(client, requestId, content),
        onFile: (key, file) =>
          updateContentFiles(client, requestId, key, (files) => files.map((f) => (f.id === file.id ? file : f))),
        alive: () => isTabOpen(tabId),
        onDirty: (dirty) => handlers.current.setDirty(dirty),
        onError: (error, key) => handlers.current.onError(error, key),
      }),
  );

  useSyncExternalStore(session.subscribe, session.getVersion, session.getVersion);

  // The tab marker follows the session even while the tab is hidden (set from the session itself);
  // this only syncs the initial value.
  useEffect(() => {
    handlers.current.setDirty(session.hasUnsaved());
  }, [session]);

  return session;
}
