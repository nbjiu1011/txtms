"use client";

import { useCallback, useMemo, useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button } from "@/shared/common";
import { isCustomerAdmin, projectRoles } from "@/entities/me";
import { useArchiveCampaigns, useArchiveContents, type ArchiveLine } from "@/entities/request";
import { copyCompletedText } from "@/features/completed-output";
import type { WorkViewProps } from "@/widgets/app-shell";
import { EMPTY_ARCHIVE_FILTERS, archiveFiltersToParams, type ArchiveFilters } from "../model/archive-view-model";
import { ArchiveFilterBar } from "./archive-filters";
import { ArchiveTable } from "./archive-table";

const DESCRIPTION =
  "검수 완료 또는 승인 완료된 콘텐츠를 보관합니다. 같은 콘텐츠의 최신 완료본을 먼저 보여주고, 이력에서 과거 완료본과 후속 요청을 펼쳐 볼 수 있습니다. 행을 누르면 콘텐츠가 열리고, 후속 요청은 콘텐츠 화면에서 작성합니다.";

/**
 * `contents` tab — completed contents of the selected project grouped by lineage (latest completion
 * first; past completions and open follow-up requests on demand), with filters and 복사. A row opens the
 * content tab (where requesters write 후속 요청). 20 lines per page (server paging; back to the first page
 * when the filters or the project change).
 */
export function ContentArchiveView({ me, context, openTab }: WorkViewProps) {
  const { projectId, customerId } = context;
  const [filters, setFilters] = useState<ArchiveFilters>(EMPTY_ARCHIVE_FILTERS);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const onFilters = useCallback((next: ArchiveFilters) => setFilters(next), []);
  const roles = projectRoles(me, projectId);
  const allowed = projectId !== null && (roles.length > 0 || isCustomerAdmin(me, customerId));
  const [page, setPage] = useListPage(JSON.stringify([projectId, filters]));
  const params = useMemo(
    () =>
      projectId !== null && allowed
        ? { ...archiveFiltersToParams(projectId, filters), page, size: LIST_PAGE_SIZE }
        : null,
    [projectId, allowed, filters, page],
  );
  const list = useArchiveContents(params);
  useClampPage(page, list.isPlaceholderData ? undefined : list.data?.page.totalPages, setPage);
  const campaigns = useArchiveCampaigns(allowed ? projectId : null);
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });

  if (!allowed) {
    return (
      <Page>
        <PageHeader title="콘텐츠" description={DESCRIPTION} />
        {me.operator ? (
          <Empty
            title="운영 담당자는 콘텐츠를 조회하지 않습니다"
            description="고객사 콘텐츠 조회 권한은 제공하지 않습니다. 고객사 초기 설정과 교정 기준은 운영 관리 메뉴에서 운영합니다."
          />
        ) : (
          <Empty
            title="이 프로젝트의 콘텐츠를 볼 권한이 없습니다"
            description="프로젝트 구성원이 아니면 요청과 콘텐츠를 조회할 수 없습니다."
          />
        )}
      </Page>
    );
  }

  const lines = list.data?.content ?? [];
  const copy = (line: ArchiveLine) =>
    void copyCompletedText({
      requestId: line.latest.requestId,
      contentKey: line.latest.contentKey,
      text: line.latest.resolvedText,
    });

  return (
    <Page>
      <PageHeader title="콘텐츠" description={DESCRIPTION} />
      <ArchiveFilterBar value={filters} onChange={onFilters} campaigns={campaigns.data ?? []} />
      <Panel aria-busy={list.isFetching}>
        {list.isError ? (
          <Empty
            title="콘텐츠를 불러오지 못했습니다"
            description={list.error.message}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        ) : (
          <ArchiveTable
            lines={lines}
            open={open}
            onToggle={(key) => setOpen((o) => ({ ...o, [key]: !o[key] }))}
            onOpenRequest={openRequest}
            onOpenContent={(id, key) => openTab({ route: "content", params: { id, key } })}
            onCopy={copy}
            loading={list.isPending}
            page={
              list.data
                ? { number: page, size: list.data.page.size, totalElements: list.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            empty={<Empty title="보관된 완료 콘텐츠가 없습니다" description="요청이 최종 완료되면 이곳에 쌓입니다. 검색 조건이 있다면 줄여 보세요." />}
          />
        )}
      </Panel>
    </Page>
  );
}
