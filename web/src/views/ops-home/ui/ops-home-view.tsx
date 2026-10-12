"use client";

import { useState } from "react";
import { formatDateTime, formatKstToday } from "@/shared/lib";
import {
  Button,
  Empty,
  Icon,
  Kpi,
  KpiGrid,
  ListItem,
  Page,
  PageHeader,
  Panel,
  PanelHeader,
  StatusChip,
  Tag,
} from "@/shared/ui";
import { useOpsDashboard, type OpsCustomer } from "@/entities/ops";
import { CreateCustomerDialog, continueToSetup, openTodo } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./ops-home.module.css";

const DESCRIPTION =
  "솔루션 운영 담당자는 고객사 초기 설정과 콘텐츠 유형·교정 기준을 운영합니다. 고객사 콘텐츠 조회 권한은 제공하지 않습니다.";

/** KPI bar: the reference fills 25% per item. */
const kpiBar = (n: number) => Math.min(100, n * 25);

/** 운영 대시보드 (reference `vOpsHome`; 내 지원 접근 is Phase 2 and not shown). */
export function OpsHomeView({ me, openTab }: WorkViewProps) {
  const dashboard = useOpsDashboard();
  const [creating, setCreating] = useState(false);
  const header = (
    <PageHeader
      className={styles.hello}
      eyebrow={<div className={styles.today}>{formatKstToday()}</div>}
      rawEyebrow
      title={`${me.name}님, 운영 현황입니다`}
      description={DESCRIPTION}
      actions={
        <Button variant="pri" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          고객사 생성
        </Button>
      }
    />
  );
  const dialog = (
    <CreateCustomerDialog
      open={creating}
      onClose={() => setCreating(false)}
      customers={dashboard.data?.customers ?? []}
      onCreated={(customer) => continueToSetup(customer.id, openTab)}
    />
  );

  if (dashboard.isPending || dashboard.isError) {
    return (
      <Page>
        {header}
        <Panel>
          {dashboard.isPending ? (
            <Empty plain title="운영 현황을 불러오는 중입니다" />
          ) : (
            <Empty
              title="운영 현황을 불러오지 못했습니다"
              description={dashboard.error.message}
              action={<Button onClick={() => void dashboard.refetch()}>다시 시도</Button>}
            />
          )}
        </Panel>
        {dialog}
      </Page>
    );
  }

  const { kpis, todos, customers, recentAudit } = dashboard.data;
  const openCustomer = (c: OpsCustomer) => openTab({ route: "opsCustomer", params: { id: String(c.id) } });

  return (
    <Page>
      {header}
      <KpiGrid>
        <Kpi interactive={false} tone="done" label="등록 고객사" value={kpis.activeCustomers} unit="건" barPercent={kpiBar(kpis.activeCustomers)} />
        <Kpi interactive={false} tone="ask" label="관리자 미지정" value={kpis.customersWithoutAdmin} unit="건" barPercent={kpiBar(kpis.customersWithoutAdmin)} />
        <Kpi
          interactive={false}
          tone="wait"
          label="데이터셋 미배정 고객사"
          value={kpis.customersWithUnassignedDatasets}
          unit="건"
          barPercent={kpiBar(kpis.customersWithUnassignedDatasets)}
        />
      </KpiGrid>
      <div className={styles.dash}>
        <div>
          <Panel>
            <PanelHeader title="초기 설정에서 남은 일" note={`${todos.length}건`} />
            {todos.length === 0 ? (
              <Empty title="초기 설정이 모두 끝났습니다" description="새 고객사를 만들면 여기에 남은 단계가 표시됩니다." />
            ) : (
              todos.map((t) => (
                <ListItem
                  key={`${t.kind}:${t.customerId}`}
                  leading={
                    <StatusChip tone="wait" className={styles.autoChip}>
                      {t.label}
                    </StatusChip>
                  }
                  title={t.customerName}
                  meta={`${t.customerDomain}  ${t.approvalEnabled ? "승인 단계 사용" : "승인 단계 미사용"}`}
                  onClick={() => openTodo(t, openTab)}
                />
              ))
            )}
          </Panel>
          <Panel>
            <PanelHeader title="고객사">
              <Button
                size="sm"
                variant="ghost"
                className={styles.headBtn}
                onClick={() => openTab({ route: "opsCustomers", params: {} })}
              >
                전체 보기
              </Button>
            </PanelHeader>
            {customers.length === 0 ? (
              <Empty title="등록된 고객사가 없습니다" />
            ) : (
              customers.map((c) => (
                <ListItem
                  key={c.id}
                  title={`${c.name}${c.active ? "" : " (비활성)"}`}
                  meta={`프로젝트 ${c.projectCount}  사용자 ${c.userCount}  진행 중 요청 ${c.activeRequestCount}`}
                  trailing={
                    c.unassignedDatasetTypes.length ? (
                      <Tag variant="hot">미배정 {c.unassignedDatasetTypes.length}</Tag>
                    ) : (
                      <Tag>배정 완료</Tag>
                    )
                  }
                  onClick={() => openCustomer(c)}
                />
              ))
            )}
          </Panel>
        </div>
        <div>
          <Panel>
            <PanelHeader title="최근 운영 이력" />
            {recentAudit.length === 0 ? (
              <Empty title="기록이 없습니다" />
            ) : (
              recentAudit.map((a) => (
                <ListItem
                  key={a.id}
                  title={a.action}
                  meta={`${a.target}  ${formatDateTime(a.at)}  ${a.actorName ?? "시스템"}`}
                />
              ))
            )}
          </Panel>
        </div>
      </div>
      {dialog}
    </Page>
  );
}
