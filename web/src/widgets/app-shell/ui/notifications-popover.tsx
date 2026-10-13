"use client";

import { cn, formatDateTime } from "@/shared/lib";
import { Button, Popover, PopoverBody, PopoverHeader } from "@/shared/common";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/entities/notification";
import styles from "./app-shell.module.css";

export interface NotificationsPopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  /** Opens the related request tab (switching context); resolves false when it cannot be viewed. */
  onOpenRequest: (requestId: string) => Promise<boolean>;
}

/** Reference J:223: 처리 완료 only for a notification with a request the user no longer has work on. */
export function notificationMeta(n: Notification): string {
  const done = n.requestId !== null && !n.pending;
  const parts = [formatDateTime(n.createdAt), n.read ? "읽음" : "안 읽음", done ? "업무 처리 완료" : "업무 미처리"];
  if (n.renotify) parts.push("재통지");
  return parts.join(" · ");
}

/** Bell popover — the only notification UI. Reminder policy: 24h interval, max 3 times. */
export function NotificationsPopover({ open, anchor, onClose, onOpenRequest }: NotificationsPopoverProps) {
  const { data } = useNotifications(true);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.items ?? [];

  const openItem = async (n: Notification) => {
    if (!n.requestId) {
      if (!n.read) markRead.mutate(n.id);
      onClose();
      return;
    }
    const opened = await onOpenRequest(n.requestId);
    if (!opened) return;
    if (!n.read) markRead.mutate(n.id);
    onClose();
  };

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} label="알림">
      <PopoverHeader>
        <b>알림</b>
        <span className={styles.popNote}>24시간 간격 · 최대 3회</span>
        <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
          모두 읽음
        </Button>
      </PopoverHeader>
      <PopoverBody>
        {items.length === 0 ? (
          <div className={styles.popEmpty}>알림이 없습니다</div>
        ) : (
          items.map((n) => (
            <button key={n.id} type="button" className={cn(styles.nt, n.read && styles.read)} onClick={() => void openItem(n)}>
              <span className={styles.ud} aria-hidden="true" />
              <span className={styles.nm}>
                {n.text}
                <span>{notificationMeta(n)}</span>
              </span>
            </button>
          ))
        )}
      </PopoverBody>
    </Popover>
  );
}
