"use client";

import { cn, formatDateTime } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel, PanelBody, Tag } from "@/shared/ui";
import { Button } from "@/shared/common";
import { RichTextView } from "@/shared/ui/rich-text";
import { isCustomerAdmin } from "@/entities/me";
import { noticeScopeText } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useNoticeTab } from "../model/use-notice-tab";
import styles from "./notice-detail.module.css";

/** `notice` tab — one notice to read: scope, author, time, 수정됨 and the body (contract §19). */
export function NoticeDetailView({ tab, me, context, openTab, setTitle }: WorkViewProps) {
  const { notice, missing } = useNoticeTab({ tab, setTitle });
  const users = useUserDirectory(notice.data?.customerId ?? null);
  const toList = () => openTab({ route: "notices", params: {} });
  const back = <Button onClick={toList}>목록</Button>;

  if (!notice.data) {
    return (
      <Page>
        <PageHeader title="공지" actions={back} />
        <Panel>
          {missing ? (
            <Empty title="공지를 찾을 수 없습니다" description="철회되었거나 볼 수 있는 범위의 공지가 아닙니다." action={back} />
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
  const projectName = (id: number) => context.projects.find((p) => p.id === id)?.name;
  return (
    <Page aria-busy={notice.isFetching}>
      <PageHeader
        title={n.title}
        actions={
          <div className={styles.actions}>
            {back}
            {isCustomerAdmin(me, n.customerId) ? (
              <Button onClick={() => openTab({ route: "adminNotice", params: { id: String(n.id) } })}>
                공지 관리에서 보기
              </Button>
            ) : null}
          </div>
        }
      />
      <Panel>
        <PanelBody>
          <div className={cn(styles.meta, styles.block)}>
            <span>{noticeScopeText(n, projectName)}</span>
            <span>{users.name(n.authorId)}</span>
            <span className={styles.when}>{formatDateTime(n.createdAt)}</span>
            {n.edited ? <Tag>수정됨</Tag> : null}
          </div>
          <RichTextView className={styles.body} value={n.body} />
        </PanelBody>
      </Panel>
    </Page>
  );
}
