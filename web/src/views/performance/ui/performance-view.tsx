"use client";

import { useState } from "react";
import { kstDateKey } from "@/shared/lib";
import { Avatar, Bar, Empty, Kpi, KpiGrid, Page, PageHeader, Panel, PanelBody, PanelHeader, Table } from "@/shared/ui";
import { Button } from "@/shared/common";
import { usePerformance, type Performance } from "@/entities/dashboard";
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
        <Table>
          <thead>
            <tr>
              <th>사용자</th>
              <th>검수 완료 처리</th>
              <th>공동 검수 참여</th>
              <th>배정·관리</th>
              <th>현재 활성</th>
              <th className={styles.barCol}>
                <span className={styles.sr}>실적 비율</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => {
              const user = users.get(p.userId);
              const name = user?.name ?? "-";
              return (
                <tr key={p.userId}>
                  <td>
                    <span className={styles.person}>
                      <Avatar name={name} color={user?.avatarColor} size={22} />
                      {name}
                    </span>
                  </td>
                  <td>{p.completedAsPrimary}</td>
                  <td>{p.coReviewed}</td>
                  <td>{p.assignmentsManaged}</td>
                  <td>{p.active}</td>
                  <td>
                    <Bar percent={((p.completedAsPrimary + p.coReviewed) / max) * 100} label={`${name} 실적`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {data.people.length === 0 ? <Empty plain title="해당하는 검수자가 없습니다" /> : null}
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
