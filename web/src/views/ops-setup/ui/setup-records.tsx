"use client";

import { LIST_PAGE_SIZE, formatDate, formatDateTime, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import { useSampleOverview, useSetupLogs, type OpsCustomer, type SampleRequest, type SetupLog } from "@/entities/ops";
import { ContentTypeChip, RequestStatusChip } from "@/entities/request";
import styles from "./ops-setup.module.css";

export interface SamplePanelProps {
  customer: OpsCustomer;
  /** The customer has an active project (a sample needs one). */
  hasActiveProject: boolean;
  onCreate: () => void;
  onClear: (sampleCount: number, realCount: number) => void;
}

/** Sample requests are not opened from here: operators do not read request contents. */
const SAMPLE_COLUMNS: DataTableColumn<SampleRequest>[] = [
  { id: "id", name: "요청 ID", width: "128px", cell: (r) => <span className={styles.when}>{r.id}</span> },
  { id: "title", name: "제목", grow: 1, minWidth: "200px", wrap: true, cell: (r) => r.title },
  { id: "type", name: "유형", width: "100px", cell: (r) => <ContentTypeChip type={r.type} showLabel /> },
  { id: "status", name: "상태", width: "104px", cell: (r) => <RequestStatusChip status={r.status} /> },
  { id: "created", name: "생성일", width: "96px", cell: (r) => formatDate(r.createdAt) },
];

/**
 * 샘플 요청·콘텐츠 (reference `SampleDataPanel` + J:217): sample customers only — other customers get the
 * reason instead of the actions. 샘플만 초기화 is destructive (warn, confirmed by `ClearSamplesDialog`).
 */
export function SamplePanel({ customer, hasActiveProject, onCreate, onClear }: SamplePanelProps) {
  const overview = useSampleOverview(customer.id, customer.sample);
  const samples = overview.data?.samples ?? [];
  const real = overview.data?.realRequestCount ?? 0;
  if (!customer.sample) {
    return (
      <Panel className={styles.block} aria-label="샘플 요청·콘텐츠">
        <PanelHeader title="샘플 요청·콘텐츠">
          <Tag>E-12.2</Tag>
        </PanelHeader>
        <PanelBody>
          <p className={styles.mutedSmall}>
            샘플 데이터 작업은 샘플 고객사에서만 가능합니다. {customer.name}은(는) 실제 고객사라 샘플 요청을 만들거나
            지우지 않습니다.
          </p>
        </PanelBody>
      </Panel>
    );
  }
  return (
    <Panel className={styles.block} aria-label="샘플 요청·콘텐츠" aria-busy={overview.isFetching}>
      <PanelHeader title="샘플 요청·콘텐츠" note={overview.data ? `샘플 데이터 ${samples.length}건` : undefined}>
        <Tag>E-12.2</Tag>
        <span className={styles.sp} />
        <Button size="sm" disabled={!hasActiveProject} onClick={onCreate}>
          샘플 요청 생성
        </Button>
        <Button size="sm" variant="warn" disabled={samples.length === 0} onClick={() => onClear(samples.length, real)}>
          샘플만 초기화
        </Button>
      </PanelHeader>
      {overview.isError ? (
        <Empty
          title="샘플을 불러오지 못했습니다"
          description={overview.error.message}
          action={<Button onClick={() => void overview.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="샘플 요청"
          columns={SAMPLE_COLUMNS}
          data={samples}
          loading={overview.isPending}
          empty={
            <Empty
              plain
              title="생성된 샘플이 없습니다."
              description={hasActiveProject ? "샘플 요청 생성으로 시연용 요청을 만드세요." : "사용 중인 프로젝트를 먼저 만드세요."}
            />
          }
        />
      )}
      <PanelBody>
        <p className={styles.mutedSmall}>
          <b>실제 운영 데이터 {real}건</b>은 초기화 대상이 아닙니다. 요청·완료 묶음·업무 이력은 그대로 보존됩니다.
        </p>
        <p className={styles.faintSmall}>
          샘플은 <Tag>샘플</Tag> 표시로 구분하고 실적 집계에서 제외합니다.
        </p>
      </PanelBody>
    </Panel>
  );
}

const LOG_COLUMNS: DataTableColumn<SetupLog>[] = [
  { id: "at", name: "시각", width: "150px", cell: (l) => <span className={styles.when}>{formatDateTime(l.at)}</span> },
  { id: "actor", name: "실행자", width: "110px", cell: (l) => l.actorName ?? "시스템" },
  { id: "action", name: "작업", width: "170px", wrap: true, cell: (l) => l.action },
  { id: "target", name: "대상", width: "180px", wrap: true, cell: (l) => l.target },
  {
    id: "result",
    name: "결과",
    grow: 1,
    minWidth: "200px",
    wrap: true,
    cell: (l) => <span className={styles.detail}>{l.result}</span>,
  },
];

/** 시드 실행 이력 (reference `SeedLogTable`): the customer's setup log, newest first, 20 per page (server, no row click). */
export function SeedLogPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useListPage(String(customerId));
  const logs = useSetupLogs(customerId, page, LIST_PAGE_SIZE);
  useClampPage(page, logs.isPlaceholderData ? undefined : logs.data?.page.totalPages, setPage);
  return (
    <Panel className={styles.block} aria-busy={logs.isFetching}>
      <PanelHeader title="시드 실행 이력" note="대상, 실행자, 결과, 영향 범위를 남깁니다" />
      {logs.isError ? (
        <Empty
          title="이력을 불러오지 못했습니다"
          description={logs.error.message}
          action={<Button onClick={() => void logs.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="시드 실행 이력"
          columns={LOG_COLUMNS}
          data={logs.data?.content ?? []}
          loading={logs.isPending}
          page={logs.data ? { number: page, size: logs.data.page.size, totalElements: logs.data.page.totalElements } : undefined}
          onPage={setPage}
          empty={<Empty plain title="실행 이력이 없습니다" description="프로젝트 생성, 초대, 시드를 실행하면 여기에 남습니다." />}
        />
      )}
    </Panel>
  );
}
