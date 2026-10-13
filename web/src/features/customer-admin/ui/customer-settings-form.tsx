"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/shared/api";
import { toast } from "@/shared/ui";
import { Field, Input, Select } from "@/shared/common";
import {
  NOTIFY_CHANNELS,
  NOTIFY_CHANNEL_LABEL,
  customerKeys,
  updateCustomerSettings,
  type Customer,
  type CustomerSettingsPatch,
  type NotifyChannel,
} from "@/entities/customer";
import styles from "./admin.module.css";

/** Reference choices `확정 납기 n일 전` (1–3); a stored value outside them stays selectable. */
export function dueSoonOptions(current: number): number[] {
  const base = [1, 2, 3];
  return base.includes(current) ? base : [...base, current].sort((a, b) => a - b);
}

export interface CustomerSettingsFormProps {
  customer: Customer;
}

/**
 * 운영 설정 (reference `vCustomer`): the name saves on change (blur / Enter), the selects at once;
 * domain is read-only. Each save is one `PATCH …/settings` with the changed key only.
 */
export function CustomerSettingsForm({ customer }: CustomerSettingsFormProps) {
  const id = useId();
  const client = useQueryClient();
  const [name, setName] = useState(customer.name);
  const [nameError, setNameError] = useState<string | null>(null);

  const save = async (patch: Partial<CustomerSettingsPatch>, done: string): Promise<boolean> => {
    try {
      await updateCustomerSettings(customer.id, patch);
    } catch (error) {
      const message = isApiError(error) ? error.message : "설정을 저장하지 못했습니다";
      toast(message);
      if ("name" in patch) setNameError(message);
      return false;
    }
    await client.invalidateQueries({ queryKey: customerKeys.all });
    toast(done);
    return true;
  };

  const saveName = async () => {
    if (name === customer.name) return;
    setNameError(null);
    const ok = await save({ name }, "고객사 이름을 저장했습니다");
    if (!ok && !name.trim()) setName(customer.name);
  };

  return (
    <div className={styles.grid2}>
      <Field label="고객사 이름" htmlFor={`${id}-name`} error={nameError}>
        <Input
          id={`${id}-name`}
          value={name}
          aria-invalid={nameError ? true : undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveName();
          }}
        />
      </Field>
      <Field label="회사 도메인" htmlFor={`${id}-domain`} hint="외부 도메인 초대 시 경고">
        <Input id={`${id}-domain`} value={customer.domain} disabled />
      </Field>
      <Field
        label="업무 알림 채널"
        htmlFor={`${id}-channel`}
        hint="24시간 간격으로 최대 3회 재통지합니다. 이메일은 발송 대기함으로 시연합니다."
      >
        <Select
          id={`${id}-channel`}
          value={customer.notifyChannel}
          onChange={(e) => void save({ notifyChannel: e.target.value as NotifyChannel }, "운영 설정을 저장했습니다")}
        >
          {NOTIFY_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {NOTIFY_CHANNEL_LABEL[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="납기 임박 기준" htmlFor={`${id}-due`} hint="고객사 기준을 적용합니다.">
        <Select
          id={`${id}-due`}
          value={customer.dueSoonDays}
          onChange={(e) => void save({ dueSoonDays: Number(e.target.value) }, "운영 설정을 저장했습니다")}
        >
          {dueSoonOptions(customer.dueSoonDays).map((n) => (
            <option key={n} value={n}>
              {`확정 납기 ${n}일 전`}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
