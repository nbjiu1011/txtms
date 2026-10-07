/** Customers (tenants) — contract §0.5, §2.1, §11. */
export const NOTIFY_CHANNELS = ["IN_APP", "IN_APP_EMAIL"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export const NOTIFY_CHANNEL_LABEL: Record<NotifyChannel, string> = {
  IN_APP: "제품 내 알림",
  IN_APP_EMAIL: "제품 내 알림 + 이메일",
};

export interface Customer {
  id: number;
  name: string;
  domain: string;
  approvalEnabled: boolean;
  active: boolean;
  sample: boolean;
  notifyChannel: NotifyChannel;
  dueSoonDays: number;
  createdAt: string;
}

/** Customer admin settings payload (domain and approval usage are read-only). */
export type CustomerSettingsPatch = Pick<Customer, "name" | "notifyChannel" | "dueSoonDays">;
