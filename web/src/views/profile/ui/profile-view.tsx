"use client";

import { Avatar, Button, Page, PageHeader, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { useSessionStore } from "@/entities/me";
import { logout } from "@/features/auth";
import { ProfileForm } from "@/features/profile-edit";
import styles from "./profile-view.module.css";

/** `profile` tab — 내 설정: profile, display note and logout. */
export function ProfileView() {
  const me = useSessionStore((s) => s.me);
  if (!me) return null;
  return (
    <Page>
      <PageHeader title="내 설정" />
      <div className={styles.stack}>
        <Panel>
          <PanelHeader title="프로필" />
          <PanelBody>
            <div className={styles.who}>
              <Avatar name={me.name} color={me.avatarColor} size={44} />
              <div>
                <b>{me.name}</b>
                <div className={styles.email}>{me.email}</div>
              </div>
            </div>
            <ProfileForm me={me} className={styles.grid2} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="화면" />
          <PanelBody>
            <p className={styles.note}>밝은 테마로 표시합니다. 다크 테마는 추후 제공됩니다.</p>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="계정" />
          <PanelBody>
            <Button variant="warn" onClick={() => void logout()}>
              로그아웃
            </Button>
          </PanelBody>
        </Panel>
      </div>
    </Page>
  );
}
