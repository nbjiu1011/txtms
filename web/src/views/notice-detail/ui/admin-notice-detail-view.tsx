"use client";

import { useState } from "react";
import { cn, formatDateTime } from "@/shared/lib";
import { Banner, Empty, KeyValueList, Page, PageHeader, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Button } from "@/shared/common";
import { RichTextView } from "@/shared/ui/rich-text";
import { NoticeStateTag, noticeScopeText } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import {
  NoticeConfirmDialog,
  NoticeEditDialog,
  useNoticeQuickAction,
  type NoticeConfirm,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useNoticeTab } from "../model/use-notice-tab";
import { NoticeHistory } from "./notice-history";
import styles from "./notice-detail.module.css";

/**
 * `adminNotice` tab — 공지 관리 상세 for the customer admin: state (unpublished and deleted ones included), body, the
 * change history with the previous values, 게시 / 게시 중지 / 수정 / 삭제 / 복원 (contract §19, §22).
 */
export function AdminNoticeDetailView({ tab, context, openTab, setTitle }: WorkViewProps) {
  const { notice, missing } = useNoticeTab({ tab, setTitle });
  const users = useUserDirectory(notice.data?.customerId ?? null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<NoticeConfirm | null>(null);
  const quick = useNoticeQuickAction();
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
  const editable = sameCustomer && !n.deleted;
  const projectName = (id: number) => context.projects.find((p) => p.id === id)?.name;

  return (
    <Page aria-busy={notice.isFetching}>
      <PageHeader
        title={n.title}
        actions={
          <div className={styles.actions}>
            {back}
            {sameCustomer && n.deleted ? <Button onClick={() => void quick(n, "restore")}>복원</Button> : null}
            {editable ? (
              <>
                {n.published ? (
                  <Button variant="ghost" onClick={() => setConfirm({ notice: n, action: "unpublish" })}>
                    게시 중지
                  </Button>
                ) : (
                  <Button variant="pri" onClick={() => void quick(n, "publish")}>
                    게시
                  </Button>
                )}
                <Button onClick={() => setEditing(true)}>수정</Button>
                <Button variant="ghost" onClick={() => setConfirm({ notice: n, action: "delete" })}>
                  삭제
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      {n.deleted ? (
        <Banner tone="info" className={styles.block} title="삭제된 공지입니다">
          사용자에게 보이지 않고 수정하거나 게시할 수 없습니다. 복원하면 미게시 공지로 돌아갑니다.
        </Banner>
      ) : !n.published ? (
        <Banner tone="info" className={styles.block} title="미게시 공지입니다">
          사용자에게 보이지 않습니다. 게시하면 공지 목록과 대시보드에 나타납니다.
        </Banner>
      ) : null}
      {!sameCustomer ? (
        <Banner tone="info" className={styles.block} title="다른 고객사의 공지입니다">
          상단에서 이 공지의 고객사를 선택하면 수정·게시·삭제할 수 있습니다.
        </Banner>
      ) : null}
      <Panel className={styles.block}>
        <PanelHeader title="공지 정보" />
        <PanelBody>
          <KeyValueList
            items={[
              { label: "범위", value: noticeScopeText(n, projectName) },
              { label: "작성", value: `${users.name(n.authorId)}  ${formatDateTime(n.createdAt)}` },
              { label: "게시", value: n.publishedAt ? formatDateTime(n.publishedAt) : "-" },
              {
                label: "상태",
                value: (
                  <>
                    <NoticeStateTag notice={n} /> {n.edited ? <Tag>수정됨</Tag> : null}
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
      <NoticeConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </Page>
  );
}
