"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isApiError, queryKeys } from "@/shared/api";
import { Avatar, toast } from "@/shared/ui";
import type { DemoPersona } from "@/entities/me";
import { authApi } from "../api/auth-api";
import { applySession } from "../model/session";
import styles from "./auth-form.module.css";

export const demoPersonaKeys = { list: () => queryKeys.list("demo-personas", {}) };

/** Demo personas (`GET /api/auth/demo-personas`). Undefined while loading, [] when demo mode is off/unreachable. */
export function useDemoPersonas() {
  return useQuery<DemoPersona[]>({
    queryKey: demoPersonaKeys.list(),
    queryFn: async () => {
      try {
        return await authApi.demoPersonas();
      } catch (error) {
        // 404 = demo mode disabled; other errors (API down) also hide the section.
        if (isApiError(error)) return [];
        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export interface DemoPersonaListProps {
  onSuccess: () => void;
}

/** "체험 계정으로 둘러보기" — persona buttons; hidden entirely when demo mode is unavailable. */
export function DemoPersonaList({ onSuccess }: DemoPersonaListProps) {
  const { data: personas } = useDemoPersonas();
  const [pendingId, setPendingId] = useState<number | null>(null);

  if (!personas || personas.length === 0) return null;

  const login = async (persona: DemoPersona) => {
    if (pendingId !== null) return;
    setPendingId(persona.userId);
    try {
      applySession(await authApi.demoLogin(persona.userId));
      onSuccess();
    } catch (error) {
      toast(isApiError(error) ? error.message : "로그인하지 못했습니다");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className={styles.personaLabel}>
        체험 계정으로 둘러보기 <span>6개 역할</span>
      </div>
      {personas.map((persona) => (
        <button
          key={persona.userId}
          type="button"
          className={styles.persona}
          disabled={pendingId !== null}
          onClick={() => void login(persona)}
        >
          <Avatar name={persona.name} color={persona.avatarColor} size={32} />
          <span className={styles.pn}>
            <b>
              {persona.name} <span>{persona.roleLabel}</span>
            </b>
            <span>{persona.description}</span>
          </span>
        </button>
      ))}
      <p className={styles.disclaimer}>체험 계정은 시연용입니다. 초대 계정은 비밀번호 설정 후 로그인할 수 있습니다.</p>
    </>
  );
}
