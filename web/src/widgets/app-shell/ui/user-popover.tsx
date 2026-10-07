"use client";

import { Avatar, Button, Popover, PopoverBody, PopoverHeader, PopoverItem, Tag } from "@/shared/ui";
import type { Me } from "@/entities/me";
import { logout, useDemoPersonas, useSwitchPersona } from "@/features/auth";
import styles from "./app-shell.module.css";

export interface UserPopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  me: Me;
  onClose: () => void;
  onOpenProfile: () => void;
  /** After a demo persona switch (shell resets to the dashboard). */
  onSwitched: () => void;
}

/**
 * User button popover. Demo sessions get the persona switcher ("체험 계정 바꾸기");
 * regular accounts get their account entry and logout.
 */
export function UserPopover({ open, anchor, me, onClose, onOpenProfile, onSwitched }: UserPopoverProps) {
  const personas = useDemoPersonas();
  const { switchTo, pendingId } = useSwitchPersona(onSwitched);
  const list = me.demo ? (personas.data ?? []) : [];

  const openProfile = () => {
    onClose();
    onOpenProfile();
  };

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} label={me.demo ? "체험 계정 바꾸기" : "내 계정"} width={300}>
      <PopoverHeader>
        <b>{me.demo ? "체험 계정 바꾸기" : "내 계정"}</b>
        <Button size="sm" variant="ghost" onClick={openProfile}>
          내 설정
        </Button>
      </PopoverHeader>
      <PopoverBody>
        {me.demo ? (
          list.map((persona) => (
            <PopoverItem
              key={persona.userId}
              disabled={pendingId !== null}
              onClick={() => {
                if (persona.userId === me.id) return;
                onClose();
                void switchTo(persona);
              }}
            >
              <Avatar name={persona.name} color={persona.avatarColor} size={24} />
              <span className={styles.personaText}>
                {persona.name}
                <br />
                <span className={styles.personaMeta}>{persona.roleLabel}</span>
              </span>
              {persona.userId === me.id ? <Tag>현재</Tag> : null}
            </PopoverItem>
          ))
        ) : (
          <PopoverItem onClick={() => void logout()}>로그아웃</PopoverItem>
        )}
      </PopoverBody>
    </Popover>
  );
}
