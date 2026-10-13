"use client";

import { useState } from "react";
import { Banner, Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, Select } from "@/shared/common";
import { useWorkContextStore } from "@/entities/me";
import {
  assignmentOf,
  useDatasetAssignments,
  useDatasets,
  useOpsContentTypes,
  useOpsCustomer,
  useOpsCustomerOptions,
  useOpsSetupContext,
  type Dataset,
} from "@/entities/ops";
import type { Project } from "@/entities/project";
import type { ContentType } from "@/entities/request";
import {
  ClearSamplesDialog,
  DatasetRegisterDialog,
  SampleRequestDialog,
  SeedProjectDialog,
  SeedRuleDialog,
  SeedUserDialog,
  TemplateDialog,
  consumeOpsIntent,
  requestOpsIntent,
  useOpsIntent,
} from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { setupSteps } from "../model/setup-steps";
import { RuleSeedPanel, SetupStepsPanel, TemplatePanel } from "./setup-panels";
import { OpsOutboxPanel, SamplePanel, SeedLogPanel } from "./setup-records";
import styles from "./ops-setup.module.css";

type Dialog =
  | { kind: "project" }
  | { kind: "invite"; mode: "admin" | "member" }
  | { kind: "templates"; project: Project }
  | { kind: "seed"; type: ContentType; latest: Dataset }
  | { kind: "register" }
  | { kind: "sample" }
  | { kind: "clear"; samples: number; real: number }
  | null;

/** `opsSeed` tab — 초기 설정·시드 (reference `vOpsSeed`) for the selected customer. */
export function OpsSetupView({ context, openTab }: WorkViewProps) {
  // the select lists every customer (inactive included); the screen loads the chosen one with its figures
  const customers = useOpsCustomerOptions();
  const intent = useOpsIntent("opsSetup");
  const [picked, setPicked] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const list = customers.data ?? [];
  const wanted = intent?.customerId ?? picked ?? context.customerId;
  const selectedId = (list.find((c) => c.id === wanted) ?? list[0])?.id ?? null;
  const detail = useOpsCustomer(selectedId);
  const customer = detail.data?.id === selectedId ? detail.data : null;
  // working data (contract §12 setup-context): stopped projects, pending invitations and inactive customers included
  const setupContext = useOpsSetupContext(selectedId);
  const datasets = useDatasets();
  const assignments = useDatasetAssignments();
  const contentTypes = useOpsContentTypes();
  const close = () => setDialog(null);

  const pick = (id: number) => {
    consumeOpsIntent("opsSetup");
    setPicked(id);
    // reference `seedCust`: the screen and the top bar context change together (the top bar lists active
    // customers only; an inactive one stays a local selection of this screen)
    if (context.customers.some((c) => c.id === id)) useWorkContextStore.getState().setCustomer(id, null);
  };

  const header = (
    <PageHeader
      title="초기 설정·시드"
      description="고객사 도입에 필요한 초기 프로젝트, 사용자, 교정 규칙 시드와 샘플 데이터를 운영합니다. 샘플 초기화는 실제 운영 데이터를 지우지 않습니다."
      actions={
        list.length ? (
          <Select
            aria-label="고객사 선택"
            className={styles.custSel}
            value={customer?.id ?? ""}
            onChange={(e) => pick(Number(e.target.value))}
          >
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? "" : " (비활성)"}
              </option>
            ))}
          </Select>
        ) : undefined
      }
    />
  );

  if (!customer) {
    const failed = customers.isError ? customers : detail.isError ? detail : null;
    return (
      <Page>
        {header}
        <Panel>
          {customers.isPending || (selectedId !== null && detail.isPending) ? (
            <Empty plain title="고객사를 불러오는 중입니다" />
          ) : failed ? (
            <Empty
              title="고객사를 불러오지 못했습니다"
              description={failed.error?.message}
              action={<Button onClick={() => void failed.refetch()}>다시 시도</Button>}
            />
          ) : (
            <Empty title="등록된 고객사가 없습니다" description="고객사 관리에서 고객사를 먼저 만드세요." />
          )}
        </Panel>
      </Page>
    );
  }

  const projectList = setupContext.data?.projects ?? [];
  const memberList = setupContext.data?.members ?? [];
  const dsList = datasets.data ?? [];
  const asList = assignments.data ?? [];
  const typeList = contentTypes.data ?? [];

  return (
    <Page>
      {header}
      {customer.active ? null : (
        <Banner tone="danger" className={styles.block} title="비활성 고객사입니다">
          사용 재개 후 초기 설정을 진행하세요. 비활성 사유: {customer.deactivationReason ?? "-"}
        </Banner>
      )}
      <div className={styles.setupGrid}>
        <SetupStepsPanel
          steps={setupSteps(customer, projectList, memberList)}
          onInviteAdmin={() => setDialog({ kind: "invite", mode: "admin" })}
          onCreateProject={() => setDialog({ kind: "project" })}
          onInviteMember={() => setDialog({ kind: "invite", mode: "member" })}
          onOpenAssign={() => {
            requestOpsIntent("opsStandards", { customerId: customer.id, sub: "assign" });
            openTab({ route: "opsStandards", params: {} });
          }}
        />
        <RuleSeedPanel
          customer={customer}
          datasets={dsList}
          assignments={asList}
          contentTypes={typeList}
          onSeed={(type, latest) => setDialog({ kind: "seed", type, latest })}
          onRegister={() => setDialog({ kind: "register" })}
        />
      </div>
      <OpsOutboxPanel customer={customer} />
      <TemplatePanel
        projects={projectList}
        loading={setupContext.isPending}
        inactive={!customer.active}
        onEdit={(project) => setDialog({ kind: "templates", project })}
      />
      <SamplePanel
        customer={customer}
        hasActiveProject={projectList.some((p) => p.active)}
        onCreate={() => setDialog({ kind: "sample" })}
        onClear={(samples, real) => setDialog({ kind: "clear", samples, real })}
      />
      <SeedLogPanel customerId={customer.id} />

      <SeedProjectDialog
        open={dialog?.kind === "project"}
        onClose={close}
        customer={customer}
        users={memberList.map((m) => m.user)}
      />
      <SeedUserDialog
        open={dialog?.kind === "invite"}
        onClose={close}
        customer={customer}
        mode={dialog?.kind === "invite" ? dialog.mode : "admin"}
        projects={projectList}
      />
      <TemplateDialog
        open={dialog?.kind === "templates"}
        onClose={close}
        project={dialog?.kind === "templates" ? (projectList.find((p) => p.id === dialog.project.id) ?? dialog.project) : null}
      />
      {dialog?.kind === "seed" ? (
        <SeedRuleDialog
          open
          onClose={close}
          customer={customer}
          type={dialog.type}
          latest={dialog.latest}
          current={(() => {
            const assignment = assignmentOf(asList, customer.id, dialog.type);
            return assignment
              ? { assignment, dataset: dsList.find((d) => d.id === assignment.datasetId) ?? null }
              : null;
          })()}
        />
      ) : null}
      <DatasetRegisterDialog open={dialog?.kind === "register"} onClose={close} />
      <SampleRequestDialog
        open={dialog?.kind === "sample"}
        onClose={close}
        customer={customer}
        projects={projectList}
        contentTypes={typeList}
      />
      <ClearSamplesDialog
        open={dialog?.kind === "clear"}
        onClose={close}
        customer={customer}
        sampleCount={dialog?.kind === "clear" ? dialog.samples : 0}
        realCount={dialog?.kind === "clear" ? dialog.real : 0}
      />
    </Page>
  );
}
