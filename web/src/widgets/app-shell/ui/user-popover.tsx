"use client";

import { Avatar, Tag } from "@/shared/ui";
import { Popover, PopoverBody, PopoverHeader, PopoverItem, PopoverSection } from "@/shared/common";
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
 * User button popover: 내 설정 and 로그아웃 for every session. Only a demo persona session (one-click persona
 * login switched on in the API) also lists the personas to switch to.
 */
export function UserPopover({ open, anchor, me, onClose, onOpenProfile, onSwitched }: UserPopoverProps) {
  const personas = useDemoPersonas(me.demo);
  const { switchTo, pendingId } = useSwitchPersona(onSwitched);
  const list = me.demo ? (personas.data ?? []) : [];

  const openProfile = () => {
    onClose();
    onOpenProfile();
  };

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} label="내 계정" width={300}>
      <PopoverHeader>
        <Avatar name={me.name} color={me.avatarColor} size={32} />
        <b>
          {me.name}
          <br />
          <span className={styles.personaMeta}>{me.email}</span>
        </b>
      </PopoverHeader>
      <PopoverBody>
        <PopoverItem onClick={openProfile}>내 설정</PopoverItem>
        <PopoverItem
          onClick={() => {
            onClose();
            void logout();
          }}
        >
          로그아웃
        </PopoverItem>
        {list.length > 0 ? (
          <>
            <PopoverSection>체험 계정 바꾸기</PopoverSection>
            {list.map((persona) => (
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
            ))}
          </>
        ) : null}
      </PopoverBody>
    </Popover>
  );
}
