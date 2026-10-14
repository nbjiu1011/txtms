"use client";

import { Fragment, useState } from "react";
import { LIST_PAGE_SIZE, formatDate, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, DataTable, RowLink, Seg, type DataTableColumn } from "@/shared/common";
import { NoticeStateTag, noticeScopeText, useManagedNotices, type Notice } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import { NoticeEditDialog } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-notices.module.css";

type Shelf = "active" | "deleted";

/**
 * `noticeAdmin` tab — 공지 관리 (reference `vNoticeAdmin`; operator notices are Phase 2): published and unpublished
 * notices, and the deleted ones. A row opens the notice's 공지 관리 상세, which holds 게시 / 게시 중지 / 수정 / 삭제 and
 * 복원 (contract §22).
 */
export function AdminNoticesView({ context, openTab }: WorkViewProps) {
  const { customer, customerId, projects, projectId } = context;
  const [shelf, setShelf] = useState<Shelf>("active");
  const deleted = shelf === "deleted";
  const [page, setPage] = useListPage(`${customerId}-${shelf}`);
  const notices = useManagedNotices(customerId, deleted, page, LIST_PAGE_SIZE);
  useClampPage(page, notices.isPlaceholderData ? undefined : notices.data?.page.totalPages, setPage);
  const users = useUserDirectory(customerId);
  const [creating, setCreating] = useState(false);
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;
  const open = (n: Notice) => openTab({ route: "adminNotice", params: { id: String(n.id) } });
  const columns: DataTableColumn<Notice>[] = [
    {
      id: "title",
      name: "제목",
      grow: 1,
      minWidth: "240px",
      rowAction: true,
      cell: (n) => (
        <RowLink onClick={() => open(n)} label={`${n.title} 상세 보기`}>
          {n.title}
        </RowLink>
      ),
    },
    { id: "scope", name: "범위", width: "200px", wrap: true, cell: (n) => noticeScopeText(n, projectName) },
    {
      id: "author",
      name: "작성",
      width: "150px",
      cell: (n) => `${users.name(n.authorId)}  ${formatDate(n.createdAt)}`,
    },
    {
      id: "log",
      name: "이력",
      width: "180px",
      wrap: true,
      cell: (n) =>
        n.logs.length ? (
          <span className={styles.log}>
            {n.logs.map((l, i) => (
              <Fragment key={i}>
                {i > 0 ? <br /> : null}
                {`${formatDate(l.at)} ${l.action}`}
              </Fragment>
            ))}
          </span>
        ) : (
          "-"
        ),
    },
    { id: "state", name: "상태", width: "88px", cell: (n) => <NoticeStateTag notice={n} /> },
  ];

  return (
    <Page>
      <PageHeader
        title="공지 관리"
        description="미게시 공지는 사용자에게 보이지 않습니다. 공지를 누르면 게시·수정·삭제할 수 있고, 삭제한 공지는 복원할 수 있습니다."
        actions={
          <div className={styles.row}>
            <Seg<Shelf>
              label="공지 구분"
              value={shelf}
              onChange={setShelf}
              options={[
                { key: "active", label: "공지" },
                { key: "deleted", label: "삭제된 공지" },
              ]}
            />
            <Button variant="pri" onClick={() => setCreating(true)}>
              <Icon name="plus" />
              공지 작성
            </Button>
          </div>
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
            label={deleted ? "삭제된 공지 목록" : "공지 목록"}
            columns={columns}
            data={notices.data?.content ?? []}
            onRowClick={open}
            loading={notices.isPending}
            page={
              notices.data
                ? { number: page, size: notices.data.page.size, totalElements: notices.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            empty={
              deleted ? (
                <Empty title="삭제된 공지가 없습니다" />
              ) : (
                <Empty title="공지가 없습니다" description="공지 작성으로 구성원에게 알릴 내용을 올리세요." />
              )
            }
          />
        )}
      </Panel>
      <p className={styles.foot}>
        상위 범위 공지는 하위 권한으로 수정할 수 없습니다. 공통 운영 공지와 기준 변경 공지는 솔루션 운영 담당자의 후속
        범위입니다.
      </p>
      {customer ? (
        <NoticeEditDialog
          open={creating}
          onClose={() => setCreating(false)}
          customer={customer}
          projects={projects}
          currentProjectId={projectId}
          notice={null}
        />
      ) : null}
    </Page>
  );
}
