"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { configureHttpClient, refreshSession, setAccessToken, type ApiError } from "@/shared/api";
import { AUTH_PATHS } from "@/shared/config/routes";
import { toast } from "@/shared/ui";
import { useSessionStore, useWorkContextStore, type AuthSession, type Me } from "@/entities/me";
import { authApi } from "../api/auth-api";

export const SESSION_EXPIRED_MESSAGE = "세션이 만료되었습니다. 다시 로그인하세요";

/** Stores a fresh session: token in memory, user in the session store, context restored. */
export function applySession(session: AuthSession): void {
  setAccessToken(session.accessToken);
  useSessionStore.getState().setMe(session.me);
  useWorkContextStore.getState().init(session.me);
}

function clearSession(): void {
  setAccessToken(null);
  useSessionStore.getState().setAnonymous();
  useWorkContextStore.getState().reset();
}

let bootstrapStarted = false;

/**
 * Wires the http client to the session store and restores the session on start
 * (`POST /api/auth/refresh`). Mounted once by the root providers.
 */
export function useSessionBootstrap(): void {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    configureHttpClient({
      onRefreshed: (payload) => {
        const me = payload.me as Me;
        useSessionStore.getState().setMe(me);
        useWorkContextStore.getState().init(me);
      },
      onUnauthenticated: (error: ApiError) => {
        const wasAuthenticated = useSessionStore.getState().status === "authenticated";
        clearSession();
        queryClient.clear();
        if (error.code === "SESSION_EXPIRED" || wasAuthenticated) toast(SESSION_EXPIRED_MESSAGE);
        router.replace(AUTH_PATHS.login);
      },
    });
  }, [router, queryClient]);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    void refreshSession().then((session) => {
      if (!session) useSessionStore.getState().setAnonymous();
    });
  }, []);
}

/** Logs out on the server (best effort), clears local state and reloads to the login page. */
export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // the session may already be gone; local cleanup below is what matters
  }
  clearSession();
  // Full reload drops every in-memory tab state of the previous user.
  window.location.assign(AUTH_PATHS.login);
}
