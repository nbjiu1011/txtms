"use client";

import { Fragment, useState } from "react";
import { LIST_PAGE_SIZE, formatDate, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel, Table, Tag, tableClasses } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { noticeScopeText, useManagedNotices, type Notice } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import { NoticeEditDialog, WithdrawNoticeDialog } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-notices.module.css";

type Editing = { notice: Notice | null } | null;

/** `noticeAdmin` tab — 공지 관리 (reference `vNoticeAdmin`; operator notices are Phase 2). */
export function AdminNoticesView({ context, openTab }: WorkViewProps) {
  const { customer, customerId, projects, projectId } = context;
  const [page, setPage] = useListPage(String(customerId));
  const notices = useManagedNotices(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, notices.isPlaceholderData ? undefined : notices.data?.page.totalPages, setPage);
  const users = useUserDirectory(customerId);
  const [editing, setEditing] = useState<Editing>(null);
  const [withdrawing, setWithdrawing] = useState<Notice | null>(null);
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;

  return (
    <Page>
      <PageHeader
        title="공지 관리"
        description="수정과 철회 이력은 보존됩니다. 기준 변경 공지는 실제 배포 묶음에 연결합니다."
        actions={
          <Button variant="pri" onClick={() => setEditing({ notice: null })}>
            <Icon name="plus" />
            공지 작성
          </Button>
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
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>제목</th>
                  <th>범위</th>
                  <th>작성</th>
                  <th>이력</th>
                  <th>상태</th>
                  <th>
                    <span className={styles.sr}>관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {notices.data.content.map((n) => (
                  <tr key={n.id}>
                    <td className={tableClasses.ttl}>
                      <button
                        type="button"
                        className={styles.titleBtn}
                        aria-label={`${n.title} 상세 보기`}
                        onClick={() => openTab({ route: "adminNotice", params: { id: String(n.id) } })}
                      >
                        {n.title}
                      </button>
                    </td>
                    <td>{noticeScopeText(n, projectName)}</td>
                    <td>{`${users.name(n.authorId)}  ${formatDate(n.createdAt)}`}</td>
                    <td className={styles.log}>
                      {n.logs.length
                        ? n.logs.map((l, i) => (
                            <Fragment key={i}>
                              {i > 0 ? <br /> : null}
                              {`${formatDate(l.at)} ${l.action}`}
                            </Fragment>
                          ))
                        : "-"}
                    </td>
                    <td>{n.withdrawn ? <Tag variant="hot">철회</Tag> : <Tag>게시</Tag>}</td>
                    <td>
                      {n.withdrawn ? null : (
                        <div className={styles.row}>
                          <Button size="sm" onClick={() => setEditing({ notice: n })}>
                            수정
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setWithdrawing(n)}>
                            철회
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {notices.data.content.length === 0 ? <Empty title="공지가 없습니다" /> : null}
            <Pager page={page} totalPages={notices.data.page.totalPages} onPage={setPage} />
          </>
        )}
      </Panel>
      <p className={styles.foot}>
        상위 범위 공지는 하위 권한으로 수정할 수 없습니다. 공통 운영 공지와 기준 변경 공지는 솔루션 운영 담당자의 후속
        범위입니다.
      </p>
      {customer ? (
        <NoticeEditDialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          customer={customer}
          projects={projects}
          currentProjectId={projectId}
          notice={editing?.notice ?? null}
        />
      ) : null}
      <WithdrawNoticeDialog notice={withdrawing} onClose={() => setWithdrawing(null)} />
    </Page>
  );
}
