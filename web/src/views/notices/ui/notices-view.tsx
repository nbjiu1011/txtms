"use client";

import { LIST_PAGE_SIZE, formatDateTime, useClampPage, useListPage } from "@/shared/lib";
import { Empty, ListItem, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { isCustomerAdmin } from "@/entities/me";
import { noticePostedAt, noticeScopeText, useNotices, type Notice } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";

/** `notices` tab — notices of the user's scope (reference `vNotices`); a row opens the notice's detail tab. */
export function NoticesView({ me, context, openTab }: WorkViewProps) {
  const { customerId, projects } = context;
  const [page, setPage] = useListPage(String(customerId));
  const notices = useNotices(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, notices.isPlaceholderData ? undefined : notices.data?.page.totalPages, setPage);
  const users = useUserDirectory(customerId);

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;
  const meta = (n: Notice) =>
    `${noticeScopeText(n, projectName)}  ${users.name(n.authorId)}  ${formatDateTime(noticePostedAt(n))}${n.edited ? "  수정됨" : ""}`;

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
      <Panel aria-busy={notices.isFetching}>
        {notices.isPending ? (
          <Empty plain title="공지를 불러오는 중입니다" />
        ) : notices.isError ? (
          <Empty
            title="공지를 불러오지 못했습니다"
            description={notices.error.message}
            action={<Button onClick={() => void notices.refetch()}>다시 시도</Button>}
          />
        ) : notices.data.content.length === 0 ? (
          <Empty title="공지가 없습니다" />
        ) : (
          <>
            {notices.data.content.map((n) => (
              <ListItem
                key={n.id}
                title={n.title}
                meta={meta(n)}
                onClick={() => openTab({ route: "notice", params: { id: String(n.id) } })}
              />
            ))}
            <Pager page={page} totalPages={notices.data.page.totalPages} onPage={setPage} />
          </>
        )}
      </Panel>
    </Page>
  );
}
