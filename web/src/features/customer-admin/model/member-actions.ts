"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { memberApi, memberKeys, type DeactivationImpact, type Member } from "@/entities/user";
import { DEACTIVATION_PRE_BLOCK, preBlocked } from "./deactivation";
import { REISSUE_DONE_TOAST } from "./invite-form";
import { invalidateUserData } from "./invalidate";

const messageOf = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

/**
 * Row actions of the users table: 초대 재발급, 재활성화, and loading the deactivation impact before
 * the modal opens (a review in 확인 요청·승인 대기 refuses with the reference toast instead).
 */
export function useMemberActions(customerId: number) {
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);

  const run = useCallback(async <T,>(userId: number, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusyId(userId);
    try {
      return await fn();
    } finally {
      setBusyId(null);
    }
  }, []);

  const reissue = (member: Member) =>
    run(member.user.id, async () => {
      try {
        await memberApi.reissueInvitation(customerId, member.user.id);
      } catch (error) {
        toast(messageOf(error, "초대 링크를 다시 만들지 못했습니다"));
        return;
      }
      await invalidateUserData(client);
      toast(REISSUE_DONE_TOAST);
    });

  const reactivate = (member: Member) =>
    run(member.user.id, async () => {
      try {
        await memberApi.reactivate(customerId, member.user.id);
      } catch (error) {
        toast(messageOf(error, "다시 활성화하지 못했습니다"));
        return;
      }
      await invalidateUserData(client);
      toast(`${member.user.name}님을 다시 활성화했습니다`);
    });

  /** Impact for the modal, or null when the deactivation cannot start (toast shown). */
  const loadImpact = (member: Member) =>
    run(member.user.id, async (): Promise<DeactivationImpact | null> => {
      let impact: DeactivationImpact;
      try {
        impact = await client.fetchQuery({
          queryKey: memberKeys.impact(customerId, member.user.id),
          queryFn: () => memberApi.deactivationImpact(customerId, member.user.id),
          staleTime: 0,
        });
      } catch (error) {
        toast(messageOf(error, "비활성화 영향을 확인하지 못했습니다"));
        return null;
      }
      if (preBlocked(impact)) {
        toast(DEACTIVATION_PRE_BLOCK);
        return null;
      }
      return impact;
    });

  return { busyId, reissue, reactivate, loadImpact };
}
