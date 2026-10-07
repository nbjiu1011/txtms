"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { projectKeys } from "@/entities/project";
import { variableApi, variableKeys, type Variable } from "@/entities/variable";

/**
 * 삭제 of the variables table (reference `varDelete`: no confirmation, logical delete). A variable in use
 * is refused with the reference message before any call; the server checks again.
 */
export function useDeleteVariable() {
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const remove = async (variable: Variable) => {
    if (variable.inUse) {
      toast("사용 중인 변수는 삭제할 수 없습니다");
      return;
    }
    setBusyId(variable.id);
    try {
      await variableApi.remove(variable.id);
    } catch (error) {
      toast(isApiError(error) ? error.message : "변수를 삭제하지 못했습니다");
      return;
    } finally {
      setBusyId(null);
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: variableKeys.all }),
      client.invalidateQueries({ queryKey: projectKeys.all }),
    ]);
  };
  return { busyId, remove };
}
