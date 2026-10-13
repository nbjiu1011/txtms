"use client";

import { useCallback, useMemo, useState } from "react";
import { useClampPage, useListPage } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { isCustomerAdmin, projectRoles } from "@/entities/me";
import {
  EMPTY_REQUEST_FILTERS,
  REQUEST_CREATE_IMPLEMENTED,
  filtersToListParams,
  useRequests,
  type RequestFilters,
} from "@/entities/request";
import { useUserDirectory, type UserSummary } from "@/entities/user";
import { NewRequestButton } from "@/features/request-create";
import type { WorkViewProps } from "@/widgets/app-shell";
import { RequestFilterBar } from "./request-filters";
import { RequestTable } from "./request-table";

const OPERATOR_NO_CONTENT =
  "고객사 콘텐츠 조회 권한은 제공하지 않습니다. 고객사 초기 설정과 교정 기준은 운영 관리 메뉴에서 운영합니다.";

/**
 * `requests` tab — every request of the selected project with the reference filters, 20 per page
 * (server paging; back to the first page when the filters or the project change).
 */
export function RequestListView({ me, context, openTab }: WorkViewProps) {
  const { projectId, customerId, project } = context;
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_REQUEST_FILTERS);
  const onFilters = useCallback((next: RequestFilters) => setFilters(next), []);
  const roles = projectRoles(me, projectId);
  const allowed = roles.length > 0 || isCustomerAdmin(me, customerId);
  const users = useUserDirectory(customerId);
  const [page, setPage] = useListPage(JSON.stringify([projectId, filters]));
  const params = useMemo(
    () => (projectId === null ? null : filtersToListParams(projectId, filters, page)),
    [projectId, filters, page],
  );
  const list = useRequests(params ?? {}, allowed && params !== null);
  useClampPage(page, list.isPlaceholderData ? undefined : list.data?.page.totalPages, setPage);

  if (projectId === null || !allowed) {
    return (
      <Page>
        <PageHeader title="요청" />
        {me.operator ? (
          <Empty title="운영 담당자는 요청을 조회하지 않습니다" description={OPERATOR_NO_CONTENT} />
        ) : (
          <Empty
            title="이 프로젝트의 요청을 볼 권한이 없습니다"
            description="프로젝트 구성원이 아니면 요청과 콘텐츠를 조회할 수 없습니다."
          />
        )}
      </Page>
    );
  }

  const memberIds = (role: "REVIEWER") =>
    (project?.members ?? []).filter((m) => m.roles.includes(role)).map((m) => m.userId);
  const activeUser = (id: number): UserSummary | null => {
    const u = users.get(id);
    return u && u.active ? u : null;
  };
  const reviewers = memberIds("REVIEWER")
    .map(activeUser)
    .filter((u): u is UserSummary => u !== null);
  const lead = project?.leadUserId ? (users.get(project.leadUserId) ?? null) : null;
  const rows = list.data?.content ?? [];
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });

  return (
    <Page wide>
      <PageHeader
        title="요청"
        description={`${project?.name ?? ""} 프로젝트의 모든 요청입니다. 프로젝트 구성원은 담당 여부와 관계없이 조회할 수 있습니다.`}
        actions={
          REQUEST_CREATE_IMPLEMENTED && projectId !== null && roles.includes("REQUESTER") ? (
            <NewRequestButton projectId={projectId} onOpenRequest={openRequest} />
          ) : undefined
        }
      />
      <RequestFilterBar value={filters} onChange={onFilters} lead={lead} reviewers={reviewers} />
      <Panel aria-busy={list.isFetching}>
        <RequestTable rows={list.isError ? [] : rows} users={users} onOpen={openRequest} />
        {list.isPending ? (
          <Empty plain title="요청을 불러오는 중입니다" />
        ) : list.isError ? (
          <Empty
            title="요청을 불러오지 못했습니다"
            description={list.error.message}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        ) : rows.length === 0 ? (
          <Empty title="조건에 맞는 요청이 없습니다" description="검색 조건을 줄이거나 초기화해 보세요." />
        ) : null}
        {list.data && !list.isError ? (
          <Pager page={page} totalPages={list.data.page.totalPages} onPage={setPage} />
        ) : null}
      </Panel>
    </Page>
  );
}
