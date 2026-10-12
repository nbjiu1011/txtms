"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage } from "@/shared/lib";
import { Button, Empty, Pager, Panel, PanelHeader, Table, Tag, tableClasses } from "@/shared/ui";
import { useOpsCustomerProjects } from "@/entities/ops";
import styles from "./ops-customers.module.css";

export interface CustomerProjectsPanelProps {
  customerId: number;
  /** User id → name of the customer (reference data); null while loading. */
  userName: (id: number) => string | null;
}

/** 프로젝트 of the customer detail page: metadata only, stopped projects included, 20 per page. */
export function CustomerProjectsPanel({ customerId, userName }: CustomerProjectsPanelProps) {
  const [page, setPage] = useState(0);
  const projects = useOpsCustomerProjects(customerId, page, LIST_PAGE_SIZE);
  const totalPages = projects.data?.page.totalPages ?? 0;
  useClampPage(page, projects.isPlaceholderData ? undefined : projects.data?.page.totalPages, setPage);

  return (
    <Panel className={styles.audit} aria-busy={projects.isFetching}>
      <PanelHeader title="프로젝트" note={projects.data ? `${projects.data.page.totalElements}개` : undefined} />
      {projects.isPending ? (
        <Empty plain title="프로젝트를 불러오는 중입니다" />
      ) : projects.isError ? (
        <Empty
          title="프로젝트를 불러오지 못했습니다"
          description={projects.error.message}
          action={<Button onClick={() => void projects.refetch()}>다시 시도</Button>}
        />
      ) : projects.data.page.totalElements === 0 ? (
        <Empty title="프로젝트가 없습니다" description="초기 설정에서 프로젝트를 만드세요." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>프로젝트</th>
                <th>대표 검수자</th>
                <th>구성원</th>
                <th>알림톡 템플릿</th>
                <th>발신번호</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {projects.data.content.map((p) => (
                <tr key={p.id}>
                  <td className={tableClasses.ttl}>{p.name}</td>
                  <td>
                    {p.leadUserId === null ? (
                      <Tag variant="hot">미지정</Tag>
                    ) : (
                      (userName(p.leadUserId) ?? <span className={styles.faint}>-</span>)
                    )}
                  </td>
                  <td className={styles.num}>{p.members.filter((m) => m.roles.length > 0).length}명</td>
                  <td className={styles.num}>{p.templates.length}개</td>
                  <td className={styles.num}>{p.senders.length}개</td>
                  <td>{p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}
