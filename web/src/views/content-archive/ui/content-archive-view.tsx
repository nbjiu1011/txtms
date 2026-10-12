"use client";

import { useCallback, useMemo, useState } from "react";
import { LIST_PAGE_SIZE, useClampPage, useListPage } from "@/shared/lib";
import { Button, Empty, Page, PageHeader, Pager, Panel } from "@/shared/ui";
import { isCustomerAdmin, projectRoles } from "@/entities/me";
import { useArchiveCampaigns, useArchiveContents, type ArchiveLine } from "@/entities/request";
import { copyCompletedText } from "@/features/completed-output";
import { useRequestCreate } from "@/features/request-create";
import type { WorkViewProps } from "@/widgets/app-shell";
import { EMPTY_ARCHIVE_FILTERS, archiveFiltersToParams, type ArchiveFilters } from "../model/archive-view-model";
import { ArchiveFilterBar } from "./archive-filters";
import { ArchiveLineItem } from "./archive-line";

const DESCRIPTION =
  "검수 완료 또는 승인 완료된 콘텐츠를 보관합니다. 같은 콘텐츠의 최신 완료본을 먼저 보여주고, 과거 완료본과 후속 요청을 펼쳐 볼 수 있습니다.";

/**
 * `contents` tab — completed contents of the selected project grouped by lineage (latest completion
 * first; past completions and open follow-up requests on demand), with filters, copy, open in a new
 * tab and 후속 요청 for requesters. 20 lines per page (server paging; back to the first page when the
 * filters or the project change).
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
  const { followUp } = useRequestCreate(openRequest);

  if (!allowed) {
    return (
      <Page wide>
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
    <Page wide>
      <PageHeader title="콘텐츠" description={DESCRIPTION} />
      <ArchiveFilterBar value={filters} onChange={onFilters} campaigns={campaigns.data ?? []} />
      <Panel aria-busy={list.isFetching}>
        {list.isPending ? (
          <Empty plain title="콘텐츠를 불러오는 중입니다" />
        ) : list.isError ? (
          <Empty
            title="콘텐츠를 불러오지 못했습니다"
            description={list.error.message}
            action={<Button onClick={() => void list.refetch()}>다시 시도</Button>}
          />
        ) : lines.length === 0 ? (
          <Empty title="보관된 완료 콘텐츠가 없습니다" description="요청이 최종 완료되면 이곳에 쌓입니다." />
        ) : (
          <div role="list" aria-label="완료 콘텐츠">
            {lines.map((line) => (
              <ArchiveLineItem
                key={line.lineKey}
                line={line}
                open={!!open[line.lineKey]}
                onToggle={() => setOpen((o) => ({ ...o, [line.lineKey]: !o[line.lineKey] }))}
                onOpenRequest={openRequest}
                onOpenContent={(id, key) => openTab({ route: "content", params: { id, key } })}
                onCopy={copy}
                onFollowUp={
                  roles.includes("REQUESTER")
                    ? (l) => void followUp(l.latest.requestId, l.latest.contentKey)
                    : undefined
                }
              />
            ))}
          </div>
        )}
        {list.data && !list.isError ? (
          <Pager page={page} totalPages={list.data.page.totalPages} onPage={setPage} />
        ) : null}
      </Panel>
    </Page>
  );
}
