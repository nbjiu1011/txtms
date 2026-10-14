"use client";

import { useState } from "react";
import { kstDateKey } from "@/shared/lib";
import { Avatar, Bar, Empty, Kpi, KpiGrid, Page, PageHeader, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import { usePerformance, type Performance, type PerformancePerson } from "@/entities/dashboard";
import { isCustomerAdmin } from "@/entities/me";
import { useUserDirectory, type UserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { WorkloadTable } from "@/widgets/workload-table";
import {
  defaultProject,
  formatRate,
  toPerformanceParams,
  type PerformanceFilter,
  type PerformanceProject,
} from "../model/performance-filter";
import { permittedProjects, reviewerOptions } from "../model/reviewer-options";
import { PerformanceFilters } from "./performance-filters";
import styles from "./performance.module.css";

type FilterState = Omit<PerformanceFilter, "project"> & { project: PerformanceProject | null };

const INITIAL: FilterState = { period: "30", from: "", to: "", project: null, userId: null };

/** `perf` tab — 업무량·실적 for the lead of the selected projects or a customer admin (reference `vPerf`). */
export function PerformanceView({ me, context }: WorkViewProps) {
  const { customerId, projectId, projects } = context;
  const users = useUserDirectory(customerId);
  const [state, setState] = useState<FilterState>(INITIAL);

  const admin = isCustomerAdmin(me, customerId);
  const leadIds = me.memberships.filter((m) => m.lead).map((m) => m.projectId);
  const permitted = permittedProjects(projects, admin, leadIds);
  const filter: PerformanceFilter = {
    ...state,
    project: state.project ?? defaultProject(permitted.map((p) => p.id), projectId),
  };
  const reviewers = reviewerOptions(permitted, filter.project, users);
  // KST day the screen was opened (presets count back from it).
  const [today] = useState(() => kstDateKey(Date.now()));
  // Query keys are hashed by value, so a fresh params object per render is fine.
  const performance = usePerformance(customerId === null ? null : toPerformanceParams(filter, customerId, today));

  return (
    <Page>
      <PageHeader
        title="업무량·실적"
        description="고유 요청 수와 콘텐츠 수를 나눠 집계합니다. 접수 집단 완료율과 기간 내 완료량은 서로 다른 지표입니다."
      />
      <PerformanceFilters value={filter} onChange={setState} projects={permitted} reviewers={reviewers} />
      {performance.data ? (
        <PerformanceBody data={performance.data} users={users} />
      ) : performance.isError ? (
        <Panel>
          <Empty
            title="실적을 불러오지 못했습니다"
            description={performance.error.message}
            action={<Button onClick={() => void performance.refetch()}>다시 시도</Button>}
          />
        </Panel>
      ) : (
        <Panel>
          <Empty plain title="실적을 불러오는 중입니다" />
        </Panel>
      )}
    </Page>
  );
}

function PerformanceBody({ data, users }: { data: Performance; users: UserDirectory }) {
  const max = Math.max(1, ...data.people.map((p) => p.completedAsPrimary + p.coReviewed));
  const name = (p: PerformancePerson) => users.get(p.userId)?.name ?? "-";
  const columns: DataTableColumn<PerformancePerson>[] = [
    {
      id: "user",
      name: "사용자",
      width: "140px",
      cell: (p) => (
        <span className={styles.person}>
          <Avatar name={name(p)} color={users.get(p.userId)?.avatarColor} size={22} />
          {name(p)}
        </span>
      ),
    },
    { id: "primary", name: "검수 완료 처리", width: "112px", cell: (p) => p.completedAsPrimary },
    { id: "co", name: "공동 검수 참여", width: "112px", cell: (p) => p.coReviewed },
    { id: "managed", name: "배정·관리", width: "96px", cell: (p) => p.assignmentsManaged },
    { id: "active", name: "현재 활성", width: "88px", cell: (p) => p.active },
    {
      id: "bar",
      name: <span className={styles.sr}>실적 비율</span>,
      grow: 1,
      minWidth: "160px",
      cell: (p) => (
        <span className={styles.bar}>
          <Bar percent={((p.completedAsPrimary + p.coReviewed) / max) * 100} label={`${name(p)} 실적`} />
        </span>
      ),
    },
  ];
  return (
    <>
      <KpiGrid>
        <Kpi interactive={false} label="접수 요청" value={data.received} unit={`건, 콘텐츠 ${data.receivedContents}건`} />
        <Kpi
          interactive={false}
          label="접수 집단 완료율"
          value={formatRate(data.completionRate)}
          unit={`% (${data.receivedCompleted}/${data.received})`}
        />
        <Kpi
          interactive={false}
          label="기간 내 완료량"
          value={data.completedInPeriod}
          unit={`건, 콘텐츠 ${data.completedContents}건`}
        />
        <Kpi interactive={false} label="현재 진행" value={data.inProgress} unit="건" />
      </KpiGrid>
      <Panel className={styles.people}>
        <PanelHeader title="개인 실적" note="검수 완료는 주담당 처리 건, 배정·관리는 대표 검수자 활동" />
        <DataTable
          label="개인 실적"
          columns={columns}
          data={data.people}
          keyField="userId"
          empty={<Empty plain title="해당하는 검수자가 없습니다" description="기간이나 프로젝트를 바꿔 보세요." />}
        />
      </Panel>
      <Panel>
        <PanelHeader title="현재 업무량" />
        <PanelBody>
          <WorkloadTable rows={data.workload} users={users} />
        </PanelBody>
      </Panel>
    </>
  );
}
