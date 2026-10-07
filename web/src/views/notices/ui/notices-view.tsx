"use client";

import { useState } from "react";
import { formatDateTime, useViewIntent } from "@/shared/lib";
import { Button, Empty, ListItem, Page, PageHeader, Panel } from "@/shared/ui";
import { isCustomerAdmin } from "@/entities/me";
import { noticeScopeText, useNotices, type Notice } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./notices.module.css";

/** View-intent key (= route key): the dashboard asks this tab to expand a notice (payload = notice id). */
const NOTICES_INTENT = "notices";

/** `notices` tab — notices of the user's scope as an accordion (reference `vNotices`). */
export function NoticesView({ me, context, openTab }: WorkViewProps) {
  const { customerId, projects } = context;
  const notices = useNotices(customerId);
  const users = useUserDirectory(customerId);
  const [openId, setOpenId] = useState<number | null>(null);
  // A dashboard notice row opens this tab with that notice expanded; it stays the expanded one
  // until the user toggles a row (the intent is consumed then).
  const intent = useViewIntent((s) => s.intents[NOTICES_INTENT]);
  const shownId = intent !== undefined && Number.isFinite(Number(intent)) ? Number(intent) : openId;
  const toggle = (id: number) => {
    useViewIntent.getState().consume(NOTICES_INTENT);
    setOpenId(shownId === id ? null : id);
  };

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;
  const meta = (n: Notice) =>
    `${noticeScopeText(n, projectName)}  ${users.name(n.authorId)}  ${formatDateTime(n.createdAt)}${n.edited ? "  수정됨" : ""}`;

  return (
    <Page>
      <PageHeader
        title="공지"
        description="내 권한 범위의 공지만 보입니다. 고객사 전체 공지는 다른 고객사에 노출되지 않습니다."
        actions={
          isCustomerAdmin(me, customerId) ? (
            <Button onClick={() => openTab({ route: "adminNotices", params: {} })}>공지 관리</Button>
          ) : undefined
        }
      />
      <Panel className={styles.list} aria-busy={notices.isFetching}>
        {notices.isPending ? (
          <Empty plain title="공지를 불러오는 중입니다" />
        ) : notices.isError ? (
          <Empty
            title="공지를 불러오지 못했습니다"
            description={notices.error.message}
            action={<Button onClick={() => void notices.refetch()}>다시 시도</Button>}
          />
        ) : notices.data.length === 0 ? (
          <Empty title="공지가 없습니다" />
        ) : (
          notices.data.map((n) => (
            <ListItem
              key={n.id}
              title={n.title}
              meta={meta(n)}
              expanded={shownId === n.id}
              extra={shownId === n.id ? <span className={styles.body}>{n.body}</span> : null}
              onClick={() => toggle(n.id)}
            />
          ))
        )}
      </Panel>
    </Page>
  );
}
