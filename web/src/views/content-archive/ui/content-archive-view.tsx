"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { isCustomerAdmin, projectRoles } from "@/entities/me";
import { useArchiveCampaigns, useArchiveContents, type ArchiveLine } from "@/entities/request";
import { copyCompletedText } from "@/features/completed-output";
import { useRequestCreate } from "@/features/request-create";
import type { WorkViewProps } from "@/widgets/app-shell";
import { EMPTY_ARCHIVE_FILTERS, archiveFiltersToParams, type ArchiveFilters } from "../model/archive-view-model";
import { ArchiveFilterBar } from "./archive-filters";
import { ArchiveLineItem } from "./archive-line";
import styles from "./content-archive.module.css";

const DESCRIPTION =
  "검수 완료 또는 승인 완료된 콘텐츠를 보관합니다. 같은 콘텐츠의 최신 완료본을 먼저 보여주고, 과거 완료본과 후속 요청을 펼쳐 볼 수 있습니다.";

/**
 * `contents` tab — completed contents of the selected project grouped by lineage (latest completion
 * first; past completions and open follow-up requests on demand), with filters, copy, open in a new
 * tab and 후속 요청 for requesters.
 */
export function ContentArchiveView({ me, context, openTab }: WorkViewProps) {
  const { projectId, customerId } = context;
  const [filters, setFilters] = useState<ArchiveFilters>(EMPTY_ARCHIVE_FILTERS);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const onFilters = useCallback((next: ArchiveFilters) => setFilters(next), []);
  const roles = projectRoles(me, projectId);
  const allowed = projectId !== null && (roles.length > 0 || isCustomerAdmin(me, customerId));
  const params = useMemo(
    () => (projectId !== null && allowed ? archiveFiltersToParams(projectId, filters) : null),
    [projectId, allowed, filters],
  );
  const list = useArchiveContents(params);
  const campaigns = useArchiveCampaigns(allowed ? projectId : null);
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });
  const { followUp } = useRequestCreate(openRequest);

  if (!allowed) {
    return (
      <Page wide>
        <PageHeader title="콘텐츠" description={DESCRIPTION} />
        <Empty
          title="이 프로젝트의 콘텐츠를 볼 권한이 없습니다"
          description="프로젝트 구성원이 아니면 요청과 콘텐츠를 조회할 수 없습니다."
        />
      </Page>
    );
  }

  const lines = list.data?.pages.flatMap((p) => p.content) ?? [];
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
        {list.hasNextPage ? (
          <div className={styles.more}>
            <Button
              size="sm"
              aria-disabled={list.isFetchingNextPage || undefined}
              onClick={() => {
                if (!list.isFetchingNextPage) void list.fetchNextPage();
              }}
            >
              {list.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
            </Button>
          </div>
        ) : null}
      </Panel>
    </Page>
  );
}
