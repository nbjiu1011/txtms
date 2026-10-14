"use client";

import { LIST_PAGE_SIZE, formatDateTime, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel, Tag } from "@/shared/ui";
import { Button, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
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
  const openNotice = (n: Notice) => openTab({ route: "notice", params: { id: String(n.id) } });
  const columns: DataTableColumn<Notice>[] = [
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "260px",
      rowAction: true,
      cell: (n) => (
        <span>
          <RowLink onClick={() => openNotice(n)} label={`공지 ${n.title} 열기`}>
            {n.title}
          </RowLink>
          {n.edited ? (
            <>
              {" "}
              <Tag>수정됨</Tag>
            </>
          ) : null}
        </span>
      ),
    },
    { id: "scope", name: "범위", width: "220px", cell: (n) => noticeScopeText(n, projectName) },
    { id: "author", name: "작성자", width: "112px", cell: (n) => users.name(n.authorId) },
    { id: "posted", name: "게시 시각", width: "120px", cell: (n) => formatDateTime(noticePostedAt(n)) },
  ];

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
        {notices.isError ? (
          <Empty
            title="공지를 불러오지 못했습니다"
            description={notices.error.message}
            action={<Button onClick={() => void notices.refetch()}>다시 시도</Button>}
          />
        ) : (
          <DataTable
            label="공지 목록"
            columns={columns}
            data={notices.data?.content ?? []}
            onRowClick={openNotice}
            loading={notices.isPending}
            page={
              notices.data
                ? { number: page, size: notices.data.page.size, totalElements: notices.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            empty={<Empty title="공지가 없습니다" description="새 공지가 게시되면 여기에 표시됩니다." />}
          />
        )}
      </Panel>
    </Page>
  );
}
