"use client";

import { useState } from "react";
import { cn, formatDateTime } from "@/shared/lib";
import { Banner, Empty, KeyValueList, Page, PageHeader, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Button } from "@/shared/common";
import { RichTextView } from "@/shared/ui/rich-text";
import { noticeScopeText } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import { NoticeEditDialog, WithdrawNoticeDialog } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useNoticeTab } from "../model/use-notice-tab";
import { NoticeHistory } from "./notice-history";
import styles from "./notice-detail.module.css";

/**
 * `adminNotice` tab — 공지 관리 상세 for the customer admin: state (withdrawn ones included), body, the change history
 * with the previous values, 수정 / 철회 (contract §19).
 */
export function AdminNoticeDetailView({ tab, context, openTab, setTitle }: WorkViewProps) {
  const { notice, missing } = useNoticeTab({ tab, setTitle });
  const users = useUserDirectory(notice.data?.customerId ?? null);
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const toList = () => openTab({ route: "adminNotices", params: {} });
  const back = <Button onClick={toList}>목록</Button>;

  if (!notice.data) {
    return (
      <Page>
        <PageHeader title="공지 관리" actions={back} />
        <Panel>
          {missing ? (
            <Empty title="공지를 찾을 수 없습니다" description="관리하는 고객사의 공지가 아닙니다." action={back} />
          ) : notice.isError ? (
            <Empty
              title="공지를 불러오지 못했습니다"
              description={notice.error.message}
              action={<Button onClick={() => void notice.refetch()}>다시 시도</Button>}
            />
          ) : (
            <Empty plain title="공지를 불러오는 중입니다" />
          )}
        </Panel>
      </Page>
    );
  }

  const n = notice.data;
  // edits use the selected customer's projects: a notice of another customer is read-only here
  const sameCustomer = context.customer?.id === n.customerId;
  const editable = sameCustomer && !n.withdrawn;
  const projectName = (id: number) => context.projects.find((p) => p.id === id)?.name;

  return (
    <Page aria-busy={notice.isFetching}>
      <PageHeader
        title={n.title}
        actions={
          <div className={styles.actions}>
            {back}
            {editable ? (
              <>
                <Button onClick={() => setEditing(true)}>수정</Button>
                <Button variant="ghost" onClick={() => setWithdrawing(true)}>
                  철회
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      {n.withdrawn ? (
        <Banner tone="info" className={styles.block} title="철회된 공지입니다">
          목록과 알림에서 보이지 않습니다. 수정하거나 다시 게시할 수 없습니다.
        </Banner>
      ) : !sameCustomer ? (
        <Banner tone="info" className={styles.block} title="다른 고객사의 공지입니다">
          상단에서 이 공지의 고객사를 선택하면 수정하거나 철회할 수 있습니다.
        </Banner>
      ) : null}
      <Panel className={styles.block}>
        <PanelHeader title="공지 정보" />
        <PanelBody>
          <KeyValueList
            items={[
              { label: "범위", value: noticeScopeText(n, projectName) },
              { label: "작성", value: `${users.name(n.authorId)}  ${formatDateTime(n.createdAt)}` },
              {
                label: "상태",
                value: (
                  <>
                    {n.withdrawn ? <Tag variant="hot">철회</Tag> : <Tag>게시</Tag>} {n.edited ? <Tag>수정됨</Tag> : null}
                  </>
                ),
              },
            ]}
          />
        </PanelBody>
      </Panel>
      <Panel className={styles.block}>
        <PanelHeader title="내용" />
        <PanelBody>
          <RichTextView className={cn(styles.body)} value={n.body} />
        </PanelBody>
      </Panel>
      <NoticeHistory logs={n.logs} userName={(id) => users.name(id)} projectName={projectName} />
      {context.customer && editable ? (
        <NoticeEditDialog
          open={editing}
          onClose={() => setEditing(false)}
          customer={context.customer}
          projects={context.projects}
          currentProjectId={context.projectId}
          notice={n}
        />
      ) : null}
      <WithdrawNoticeDialog notice={withdrawing ? n : null} onClose={() => setWithdrawing(false)} />
    </Page>
  );
}
