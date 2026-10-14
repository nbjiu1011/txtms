"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/ui";
import { opsApi, type OpsCustomer } from "@/entities/ops";
import { invalidateOps } from "@/features/ops-admin";

/** 사용 재개 of an inactive customer (customer detail header), with the customer being saved. */
export function useCustomerStatus() {
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);

  const reactivate = async (c: Pick<OpsCustomer, "id">) => {
    setBusyId(c.id);
    try {
      await opsApi.reactivateCustomer(c.id);
      await invalidateOps(client);
      toast("사용 상태로 돌렸습니다");
    } catch (error) {
      toast(error instanceof Error ? error.message : "사용 재개하지 못했습니다");
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, reactivate };
}
