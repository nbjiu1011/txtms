"use client";

import { Fragment, useState } from "react";
import { LIST_PAGE_SIZE, formatDate, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel, Table, tableClasses } from "@/shared/ui";
import { Button, Pager, Seg } from "@/shared/common";
import { NoticeStateTag, noticeScopeText, useManagedNotices, type Notice } from "@/entities/notice";
import { useUserDirectory } from "@/entities/user";
import {
  NoticeConfirmDialog,
  NoticeEditDialog,
  useNoticeQuickAction,
  type NoticeConfirm,
} from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-notices.module.css";

type Editing = { notice: Notice | null } | null;
type Shelf = "active" | "deleted";

/**
 * `noticeAdmin` tab — 공지 관리 (reference `vNoticeAdmin`; operator notices are Phase 2): published and unpublished
 * notices with 게시 / 게시 중지 / 수정 / 삭제, and the deleted ones with 복원 (contract §22).
 */
export function AdminNoticesView({ context, openTab }: WorkViewProps) {
  const { customer, customerId, projects, projectId } = context;
  const [shelf, setShelf] = useState<Shelf>("active");
  const deleted = shelf === "deleted";
  const [page, setPage] = useListPage(`${customerId}-${shelf}`);
  const notices = useManagedNotices(customerId, deleted, page, LIST_PAGE_SIZE);
  useClampPage(page, notices.isPlaceholderData ? undefined : notices.data?.page.totalPages, setPage);
  const users = useUserDirectory(customerId);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<NoticeConfirm | null>(null);
  const quick = useNoticeQuickAction();
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;

  const actions = (n: Notice) =>
    n.deleted ? (
      <Button size="sm" onClick={() => void quick(n, "restore")}>
        복원
      </Button>
    ) : (
      <>
        {n.published ? (
          <Button size="sm" variant="ghost" onClick={() => setConfirm({ notice: n, action: "unpublish" })}>
            게시 중지
          </Button>
        ) : (
          <Button size="sm" onClick={() => void quick(n, "publish")}>
            게시
          </Button>
        )}
        <Button size="sm" onClick={() => setEditing({ notice: n })}>
          수정
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm({ notice: n, action: "delete" })}>
          삭제
        </Button>
      </>
    );

  return (
    <Page>
      <PageHeader
        title="공지 관리"
        description="미게시 공지는 사용자에게 보이지 않습니다. 수정·게시·삭제 이력은 보존되고 삭제한 공지는 복원할 수 있습니다."
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
            <Button variant="pri" onClick={() => setEditing({ notice: null })}>
              <Icon name="plus" />
              공지 작성
            </Button>
          </div>
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
                    <td>
                      <NoticeStateTag notice={n} />
                    </td>
                    <td>
                      <div className={styles.row}>{actions(n)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {notices.data.content.length === 0 ? (
              <Empty title={deleted ? "삭제된 공지가 없습니다" : "공지가 없습니다"} />
            ) : null}
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
      <NoticeConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </Page>
  );
}
