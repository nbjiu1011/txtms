"use client";

import { useState } from "react";
import { formatKstToday, useViewIntent } from "@/shared/lib";
import { Banner, Empty, Kpi, KpiGrid, Page, PageHeader, Panel } from "@/shared/ui";
import { Button } from "@/shared/common";
import { useDashboard } from "@/entities/dashboard";
import { projectRoles } from "@/entities/me";
import {
  REQUEST_CREATE_IMPLEMENTED,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  statusListParams,
  viewListParams,
  type RequestListParams,
} from "@/entities/request";
import { useUserDirectory } from "@/entities/user";
import { NewRequestButton } from "@/features/request-create";
import { ensureTabRoom, type WorkViewProps } from "@/widgets/app-shell";
import { NoticePanel, RecentPanel, TodoPanel, WorkloadPanel } from "./dashboard-panels";
import { PipelineBar } from "./pipeline-bar";
import { RequestListModal } from "./request-list-modal";
import styles from "./dashboard.module.css";

interface ListModalState {
  title: string;
  params: RequestListParams;
}

/** Role dashboard of the selected project (reference `vHome`; operators get the ops dashboard instead). */
export function DashboardView({ me, context, openTab }: WorkViewProps) {
  const { projectId, customerId, project } = context;
  const dashboard = useDashboard(me.operator ? null : projectId);
  const users = useUserDirectory(customerId);
  const [modal, setModal] = useState<ListModalState | null>(null);
  const roles = projectRoles(me, projectId);
  const today = <div className={styles.today}>{formatKstToday()}</div>;
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });

  const header = (
    <PageHeader
      className={styles.hello}
      eyebrow={today}
      rawEyebrow
      title={`${me.name}님, 오늘 처리할 업무입니다`}
      description={project ? `${project.name} 프로젝트 기준입니다.` : undefined}
      actions={
        REQUEST_CREATE_IMPLEMENTED && projectId !== null && roles.includes("REQUESTER") ? (
          <NewRequestButton projectId={projectId} onOpenRequest={openRequest} canOpenTab={ensureTabRoom} />
        ) : undefined
      }
    />
  );

  if (projectId === null || customerId === null) {
    return (
      <Page>
        {header}
        <Panel>
          <Empty title="참여 중인 프로젝트가 없습니다" description="프로젝트에 초대되면 요청과 업무가 여기에 표시됩니다." />
        </Panel>
      </Page>
    );
  }

  if (dashboard.isPending || dashboard.isError) {
    return (
      <Page>
        {header}
        <Panel>
          {dashboard.isPending ? (
            <Empty plain title="대시보드를 불러오는 중입니다" />
          ) : (
            <Empty
              title="대시보드를 불러오지 못했습니다"
              description={dashboard.error.message}
              action={<Button onClick={() => void dashboard.refetch()}>다시 시도</Button>}
            />
          )}
        </Panel>
      </Page>
    );
  }

  const data = dashboard.data;
  const scope = { projectId, customerId };
  const isLead = roles.includes("LEAD");

  return (
    <Page>
      {header}
      {data.adminViewing ? (
        <Banner
          tone="info"
          title="고객사 관리자 권한으로 보고 있습니다"
          actions={
            <Button
              size="sm"
              onClick={() => {
                useViewIntent.getState().request("adminUsers", "audit");
                openTab({ route: "adminUsers", params: {} });
              }}
            >
              접근 기록 보기
            </Button>
          }
        >
          소속 고객사의 모든 프로젝트를 조회할 수 있지만 검수와 최종 승인은 관리 권한으로 처리할 수 없습니다. 다른
          요청자가 작성 중인 요청은 보이지 않습니다.
        </Banner>
      ) : null}
      <PipelineBar
        projectName={project?.name ?? ""}
        total={data.pipelineTotal}
        stages={data.pipeline}
        onSelect={(status) =>
          setModal({ title: REQUEST_STATUS_LABEL[status], params: statusListParams(projectId, status) })
        }
      />
      {data.kpis.length > 0 ? (
        <KpiGrid>
          {data.kpis.map((k) => (
            <Kpi
              key={k.view}
              tone={REQUEST_STATUS_TONE[k.tone]}
              label={k.label}
              value={k.count}
              unit="건"
              barPercent={Math.min(100, k.count * 20)}
              onClick={() => setModal({ title: k.label, params: viewListParams(k.view, scope) })}
            />
          ))}
        </KpiGrid>
      ) : null}
      <div className={styles.dash}>
        <div>
          <TodoPanel todos={data.todos} onOpen={openRequest} />
          <RecentPanel
            recent={data.recent}
            users={users}
            onOpen={openRequest}
            onShowAll={() => openTab({ route: "requests", params: {} })}
          />
        </div>
        <div>
          {isLead ? <WorkloadPanel rows={data.workload} users={users} /> : null}
          <NoticePanel
            notices={data.notices}
            projects={context.projects}
            onShowAll={() => openTab({ route: "notices", params: {} })}
            onOpen={(id) => openTab({ route: "notice", params: { id: String(id) } })}
          />
        </div>
      </div>
      <RequestListModal
        title={modal?.title ?? ""}
        params={modal?.params ?? null}
        onClose={() => setModal(null)}
        onOpenRequest={openRequest}
      />
    </Page>
  );
}
