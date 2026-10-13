"use client";

import { LIST_PAGE_SIZE, formatDateTime, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Panel, PanelBody, PanelHeader, ReadOnlyBox, Table, Tag } from "@/shared/ui";
import { Button, Pager } from "@/shared/common";
import { OUTBOX_KIND_LABEL, OUTBOX_STATUS_LABEL } from "@/entities/audit";
import { useOpsOutbox, useSampleOverview, useSetupLogs, type OpsCustomer } from "@/entities/ops";
import { REQUEST_STATUS_LABEL } from "@/entities/request";
import styles from "./ops-setup.module.css";

export interface SamplePanelProps {
  customer: OpsCustomer;
  /** The customer has an active project (a sample needs one). */
  hasActiveProject: boolean;
  onCreate: () => void;
  onClear: (sampleCount: number, realCount: number) => void;
}

/**
 * 샘플 요청·콘텐츠 (reference `SampleDataPanel` + J:217): sample customers only — other customers get the
 * reason instead of the actions.
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
      <PanelHeader title="샘플 요청·콘텐츠">
        <Tag>E-12.2</Tag>
        <span className={styles.sp} />
        <Button size="sm" disabled={!hasActiveProject} onClick={onCreate}>
          샘플 요청 생성
        </Button>
        <Button size="sm" variant="ghost" disabled={samples.length === 0} onClick={() => onClear(samples.length, real)}>
          샘플만 초기화
        </Button>
      </PanelHeader>
      <PanelBody>
        <div className={styles.boxes}>
          <ReadOnlyBox className={styles.box}>
            <b>샘플 데이터 {samples.length}건</b>
            {overview.isPending ? (
              <div className={styles.muted}>불러오는 중입니다.</div>
            ) : samples.length ? (
              samples.map((r) => (
                <div key={r.id}>
                  {r.id}  {r.title}  {REQUEST_STATUS_LABEL[r.status]}
                </div>
              ))
            ) : (
              <div className={styles.muted}>생성된 샘플이 없습니다.</div>
            )}
          </ReadOnlyBox>
          <ReadOnlyBox className={styles.box}>
            <b>실제 운영 데이터 {real}건</b>
            <div className={styles.muted}>초기화 대상이 아닙니다. 요청·완료 묶음·업무 이력은 그대로 보존됩니다.</div>
          </ReadOnlyBox>
        </div>
        <p className={styles.faintSmall}>
          샘플은 <Tag>샘플</Tag> 표시로 구분하고 실적 집계에서 제외합니다.
        </p>
      </PanelBody>
    </Panel>
  );
}

/** 시드 실행 이력 (reference `SeedLogTable`): the customer's setup log, newest first, 20 per page (server). */
export function SeedLogPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useListPage(String(customerId));
  const logs = useSetupLogs(customerId, page, LIST_PAGE_SIZE);
  const rows = logs.data?.content ?? [];
  const totalPages = logs.data?.page.totalPages ?? 0;
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
        <>
          <Table>
            <thead>
              <tr>
                <th>시각</th>
                <th>실행자</th>
                <th>작업</th>
                <th>대상</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    {logs.isPending ? "불러오는 중입니다." : "실행 이력이 없습니다."}
                  </td>
                </tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id}>
                    <td className={styles.when}>{formatDateTime(l.at)}</td>
                    <td>{l.actorName ?? "시스템"}</td>
                    <td>{l.action}</td>
                    <td>{l.target}</td>
                    <td className={styles.detail}>{l.result}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

/**
 * 메일 발송 대기함 of the selected customer's users (operator, `GET /api/ops/outbox?customerId=`):
 * invitation, reset and reminder mails, newest first. Token links are masked outside demo mode — only the
 * recipient can use them.
 */
export function OpsOutboxPanel({ customer }: { customer: Pick<OpsCustomer, "id" | "name"> }) {
  // the page belongs to one customer: a new customer starts on its first page
  const [page, setPage] = useListPage(String(customer.id));
  const outbox = useOpsOutbox(customer.id, page, LIST_PAGE_SIZE);
  const mails = outbox.data?.content ?? [];
  return (
    <Panel className={styles.block} aria-label="메일 발송 대기함" aria-busy={outbox.isFetching}>
      <PanelHeader
        title={`메일 발송 대기함 · ${customer.name}`}
        note="실제 메일 발송 연동 전입니다. 초대·재설정 링크는 데모 모드에서만 보입니다"
      />
      {outbox.isPending ? (
        <PanelBody>불러오는 중입니다</PanelBody>
      ) : outbox.isError ? (
        <PanelBody>
          발송 대기함을 불러오지 못했습니다{" "}
          <Button size="sm" onClick={() => void outbox.refetch()}>
            다시 시도
          </Button>
        </PanelBody>
      ) : mails.length === 0 ? (
        <PanelBody>발송 대기 메일이 없습니다.</PanelBody>
      ) : (
        mails.map((m) => (
          <PanelBody key={m.id} className={styles.mail}>
            <b>
              {m.subject} · {m.to}
            </b>
            <p className={styles.mailBody}>{m.body}</p>
            <span className={styles.mailMeta}>
              {OUTBOX_KIND_LABEL[m.kind] ?? m.kind} · {OUTBOX_STATUS_LABEL[m.status] ?? m.status} ·{" "}
              {formatDateTime(m.sentAt ?? m.createdAt)}
              {m.masked ? (
                <Tag variant="fill" className={styles.masked}>
                  링크 가림
                </Tag>
              ) : null}
            </span>
          </PanelBody>
        ))
      )}
      <Pager page={page} totalPages={outbox.data?.page.totalPages ?? 0} onPage={setPage} />
    </Panel>
  );
}
