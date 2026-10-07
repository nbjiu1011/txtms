"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import type { DemoPersona } from "@/entities/me";
import { authApi } from "../api/auth-api";
import { applySession } from "./session";

/**
 * Switches to another demo persona (`POST /api/auth/demo-login`) and drops the previous user's cache.
 * `onSwitched` runs right before the new session is applied.
 */
export function useSwitchPersona(onSwitched: () => void) {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const switchTo = useCallback(
    async (persona: DemoPersona) => {
      if (pendingId !== null) return;
      setPendingId(persona.userId);
      try {
        const session = await authApi.demoLogin(persona.userId);
        queryClient.clear();
        onSwitched();
        applySession(session);
        toast(`${session.me.name} 계정으로 바꿨습니다`);
      } catch (error) {
        toast(isApiError(error) ? error.message : "계정을 바꾸지 못했습니다");
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, queryClient, onSwitched],
  );

  return { switchTo, pendingId };
}
