"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage } from "@/shared/lib";
import { Empty, Panel, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import { useOpsCustomerProjects } from "@/entities/ops";
import type { Project } from "@/entities/project";
import styles from "./ops-customers.module.css";

export interface CustomerProjectsPanelProps {
  customerId: number;
  /** User id → name of the customer (reference data); null while loading. */
  userName: (id: number) => string | null;
}

/** 프로젝트 of the customer detail page: metadata only, stopped projects included, 20 per page (no row click). */
export function CustomerProjectsPanel({ customerId, userName }: CustomerProjectsPanelProps) {
  const [page, setPage] = useState(0);
  const projects = useOpsCustomerProjects(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, projects.isPlaceholderData ? undefined : projects.data?.page.totalPages, setPage);

  const columns: DataTableColumn<Project>[] = [
    { id: "name", name: "프로젝트", grow: 1, minWidth: "220px", cell: (p) => <b>{p.name}</b> },
    {
      id: "lead",
      name: "대표 검수자",
      width: "150px",
      cell: (p) =>
        p.leadUserId === null ? (
          <Tag variant="hot">미지정</Tag>
        ) : (
          (userName(p.leadUserId) ?? <span className={styles.faint}>-</span>)
        ),
    },
    {
      id: "members",
      name: "구성원",
      width: "90px",
      cell: (p) => <span className={styles.num}>{p.members.filter((m) => m.roles.length > 0).length}명</span>,
    },
    {
      id: "templates",
      name: "알림톡 템플릿",
      width: "110px",
      cell: (p) => <span className={styles.num}>{p.templates.length}개</span>,
    },
    { id: "status", name: "상태", width: "80px", cell: (p) => (p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>) },
  ];

  return (
    <Panel className={styles.audit} aria-busy={projects.isFetching}>
      <PanelHeader title="프로젝트" note={projects.data ? `${projects.data.page.totalElements}개` : undefined} />
      {projects.isError ? (
        <Empty
          title="프로젝트를 불러오지 못했습니다"
          description={projects.error.message}
          action={<Button onClick={() => void projects.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="고객사 프로젝트"
          columns={columns}
          data={projects.data?.content ?? []}
          loading={projects.isPending}
          page={
            projects.data
              ? { number: page, size: projects.data.page.size, totalElements: projects.data.page.totalElements }
              : undefined
          }
          onPage={setPage}
          empty={<Empty title="프로젝트가 없습니다" description="초기 설정에서 프로젝트를 만드세요." />}
        />
      )}
    </Panel>
  );
}
