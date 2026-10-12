"use client";

import {
  Avatar,
  Button,
  KeyValueList,
  Page,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Tag,
} from "@/shared/ui";
import { LEAD_ROLE_LABEL } from "@/entities/project";
import { NO_ROLE_LABEL, useSessionStore } from "@/entities/me";
import { PasswordChangeForm, logout } from "@/features/auth";
import { SampleResetButton } from "@/features/ops-admin";
import { ProfileForm } from "@/features/profile-edit";
import type { WorkViewProps } from "@/widgets/app-shell";
import { accountRoleLabels, profileRoleRows } from "../model/roles";
import { useMembershipNames } from "../model/use-membership-names";
import styles from "./profile-view.module.css";

/**
 * `profile` tab — 내 설정: profile (name/affiliation editable), customer and project roles (read-only),
 * password change, sample reset (operators) and logout.
 */
export function ProfileView({ context }: Pick<WorkViewProps, "context">) {
  const me = useSessionStore((s) => s.me);
  const { projectNames, customerNames } = useMembershipNames(me, context.customers);
  if (!me) return null;

  const customerName = me.customerId === null ? null : (customerNames.get(me.customerId) ?? null);
  const rows = profileRoleRows(me, projectNames, customerNames);
  const accountRoles = accountRoleLabels(me, customerNames);
  const roleItems = [
    ...rows.map((row) => ({
      label: row.customerName ? `${row.projectName} · ${row.customerName}` : row.projectName,
      value: (
        <span className={styles.tags}>
          {row.roles.map((role) => (
            <Tag key={role}>{role}</Tag>
          ))}
          {row.lead ? <Tag variant="fill">{LEAD_ROLE_LABEL}</Tag> : null}
        </span>
      ),
    })),
    ...(accountRoles.length > 0
      ? [
          {
            label: "관리 권한",
            value: (
              <span className={styles.tags}>
                {accountRoles.map((role) => (
                  <Tag key={role}>{role}</Tag>
                ))}
              </span>
            ),
          },
        ]
      : []),
  ];

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
                <div className={styles.email}>
                  {[customerName ?? (me.operator ? "솔루션 운영" : null), me.dept].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            <ProfileForm me={me} className={styles.grid2} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="소속과 역할" note="고객사 관리자가 지정합니다" />
          <PanelBody>
            <KeyValueList
              className={styles.kv}
              items={[
                { label: "고객사", value: customerName ?? "-" },
                ...(roleItems.length > 0 ? roleItems : [{ label: "프로젝트 역할", value: NO_ROLE_LABEL }]),
              ]}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="비밀번호 변경" />
          <PanelBody>
            <PasswordChangeForm />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="화면" />
          <PanelBody>
            <p className={styles.note}>밝은 테마로 표시합니다. 다크 테마는 추후 제공됩니다.</p>
          </PanelBody>
        </Panel>
        {me.operator ? (
          <Panel>
            <PanelHeader title="시연 데이터" />
            <PanelBody>
              <p className={styles.lead}>
                샘플 고객사의 요청을 기본 체험 상태로 되돌립니다. 실제 고객사 데이터는 유지됩니다.
              </p>
              <SampleResetButton />
            </PanelBody>
          </Panel>
        ) : null}
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

