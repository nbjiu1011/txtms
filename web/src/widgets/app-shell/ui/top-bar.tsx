"use client";

import { useState } from "react";
import { Avatar, Icon, Tag } from "@/shared/ui";
import { IconButton } from "@/shared/common";
import { roleSummary, useWorkContextStore, type Me } from "@/entities/me";
import { useNotifications } from "@/entities/notification";
import type { WorkContext } from "../model/use-work-context";
import { NotificationsPopover } from "./notifications-popover";
import { UserPopover } from "./user-popover";
import styles from "./top-bar.module.css";

export interface TopBarProps {
  me: Me;
  context: WorkContext;
  navOpen: boolean;
  onToggleNav: () => void;
  onOpenProfile: () => void;
  /** Opens a notified request (switching context); resolves false when it cannot be viewed. */
  onOpenRequest: (requestId: string) => Promise<boolean>;
  onPersonaSwitched: () => void;
}

type OpenPop = "notifications" | "user" | null;

/** `header.top` — menu (≤860px), customer/project context, approval tag, notifications, user. */
export function TopBar({
  me,
  context,
  navOpen,
  onToggleNav,
  onOpenProfile,
  onOpenRequest,
  onPersonaSwitched,
}: TopBarProps) {
  const [pop, setPop] = useState<OpenPop>(null);
  const [bellEl, setBellEl] = useState<HTMLButtonElement | null>(null);
  const [userEl, setUserEl] = useState<HTMLButtonElement | null>(null);
  const unread = useNotifications(true).data?.unreadCount ?? 0;
  const { customers, projects, customer, customerId, projectId } = context;
  const roles = roleSummary(me, customerId, projectId);

  const toggle = (next: Exclude<OpenPop, null>) => setPop((current) => (current === next ? null : next));
  const close = () => setPop(null);

  return (
    <header className={styles.top}>
      <IconButton
        label="메뉴"
        className={styles.menuBtn}
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
        onClick={onToggleNav}
      >
        <Icon name="menu" />
      </IconButton>
      <div className={styles.ctx}>
        <select
          aria-label="고객사"
          value={customerId ?? ""}
          onChange={(event) => {
            const id = Number(event.target.value);
            useWorkContextStore.getState().setCustomer(id, null);
          }}
        >
          {customerId === null ? <option value="" /> : null}
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : " (비활성)"}
            </option>
          ))}
        </select>
        <span className={styles.slash} aria-hidden="true">
          /
        </span>
        <select
          aria-label="프로젝트"
          value={projectId ?? ""}
          onChange={(event) => useWorkContextStore.getState().setProject(Number(event.target.value))}
        >
          {projects.length === 0 ? <option value="">참여 프로젝트 없음</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.active ? "" : " (중지)"}
            </option>
          ))}
        </select>
        {customer ? (
          <Tag variant="fill" className={styles.approvalTag} title="고객사 설정">
            {customer.approvalEnabled ? "승인 단계 사용" : "승인 단계 미사용"}
          </Tag>
        ) : null}
      </div>
      <div className={styles.grow} />
      <IconButton
        ref={setBellEl}
        label={unread ? `알림, 안 읽은 알림 ${unread}개` : "알림"}
        badge={unread}
        aria-haspopup="dialog"
        aria-expanded={pop === "notifications"}
        onClick={() => toggle("notifications")}
      >
        <Icon name="bell" />
      </IconButton>
      <button
        ref={setUserEl}
        type="button"
        className={styles.me}
        aria-label={`${me.name}, ${roles}`}
        aria-haspopup="dialog"
        aria-expanded={pop === "user"}
        onClick={() => toggle("user")}
      >
        <Avatar name={me.name} color={me.avatarColor} />
        <span className={styles.meName}>{me.name}</span>
        <em>{roles}</em>
      </button>
      <NotificationsPopover
        open={pop === "notifications"}
        anchor={bellEl}
        onClose={close}
        onOpenRequest={onOpenRequest}
      />
      <UserPopover
        open={pop === "user"}
        anchor={userEl}
        me={me}
        onClose={close}
        onOpenProfile={onOpenProfile}
        onSwitched={onPersonaSwitched}
      />
    </header>
  );
}
