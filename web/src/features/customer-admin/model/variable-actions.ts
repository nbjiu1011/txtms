"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { projectKeys } from "@/entities/project";
import { variableApi, variableKeys, type Variable } from "@/entities/variable";

/**
 * 삭제 of a variable (logical delete; asked first in the variable dialog). A variable in use is refused with the
 * reference message before any call; the server checks again. `remove` resolves true once deleted.
 */
export function useDeleteVariable() {
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);
  const remove = async (variable: Variable): Promise<boolean> => {
    if (variable.inUse) {
      toast("사용 중인 변수는 삭제할 수 없습니다");
      return false;
    }
    setBusyId(variable.id);
    try {
      await variableApi.remove(variable.id);
    } catch (error) {
      toast(isApiError(error) ? error.message : "변수를 삭제하지 못했습니다");
      return false;
    } finally {
      setBusyId(null);
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: variableKeys.all }),
      client.invalidateQueries({ queryKey: variableKeys.logsAll }),
      client.invalidateQueries({ queryKey: projectKeys.all }),
    ]);
    toast("변수를 삭제했습니다");
    return true;
  };
  return { busyId, remove };
}
