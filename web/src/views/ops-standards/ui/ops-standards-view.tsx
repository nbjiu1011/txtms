"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, Pager, SubTabs } from "@/shared/common";
import {
  useDatasetAssignments,
  useDatasets,
  useOpsContentTypes,
  useOpsCustomerOptions,
  useOpsCustomers,
  type Dataset,
} from "@/entities/ops";
import {
  DatasetRegisterDialog,
  DatasetRulesDialog,
  consumeOpsIntent,
  useOpsIntent,
} from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { AssignMatrix, EffectiveRulesPanel } from "./assign-matrix";
import { ContentTypeTable, DatasetSeedPanel } from "./standards-panels";
import styles from "./ops-standards.module.css";

type Sub = "types" | "assign" | "ds";
const SUBS: readonly Sub[] = ["types", "assign", "ds"];
const isSub = (value: unknown): value is Sub => typeof value === "string" && (SUBS as readonly string[]).includes(value);

/**
 * `standards` tab — 유형·교정 기준 (reference `vStandards` + J:130): 유형 관리 / 유효 데이터셋 배정, and the
 * 데이터셋 시드 page (registered versions, registration, rules).
 */
export function OpsStandardsView({ context }: WorkViewProps) {
  const intent = useOpsIntent("opsStandards");
  const [subPicked, setSubPicked] = useState<Sub>("assign");
  const [customerPicked, setCustomerPicked] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [rulesOf, setRulesOf] = useState<Dataset | null>(null);
  // the matrix pages through customers; the rules panel picks from the reference list
  const [matrixPage, setMatrixPage] = useState(0);
  const matrix = useOpsCustomers(matrixPage, LIST_PAGE_SIZE);
  useClampPage(matrixPage, matrix.isPlaceholderData ? undefined : matrix.data?.page.totalPages, setMatrixPage);
  const customers = useOpsCustomerOptions();
  const datasets = useDatasets();
  const assignments = useDatasetAssignments();
  const contentTypes = useOpsContentTypes();

  const sub: Sub = isSub(intent?.sub) ? intent.sub : subPicked;
  const pickSub = (next: Sub) => {
    if (intent?.customerId !== undefined) setCustomerPicked(intent.customerId);
    consumeOpsIntent("opsStandards");
    setSubPicked(next);
  };
  const list = customers.data ?? [];
  const wanted = intent?.customerId ?? customerPicked ?? context.customerId;
  const customer = list.find((c) => c.id === wanted) ?? list[0] ?? null;
  const pickCustomer = (id: number) => {
    consumeOpsIntent("opsStandards");
    setSubPicked(sub);
    setCustomerPicked(id);
  };
  const dsList = datasets.data ?? [];
  const typeList = contentTypes.data ?? [];

  const dialogs = (
    <>
      <DatasetRegisterDialog open={registering} onClose={() => setRegistering(false)} />
      <DatasetRulesDialog dataset={rulesOf} onClose={() => setRulesOf(null)} />
    </>
  );

  if (sub === "ds") {
    return (
      <Page>
        <div className={styles.dsHead}>
          <h1>교정 데이터셋</h1>
          <Button onClick={() => pickSub("assign")}>배정표</Button>
        </div>
        <DatasetSeedPanel
          datasets={dsList}
          loading={datasets.isPending}
          onRegister={() => setRegistering(true)}
          onOpen={setRulesOf}
        />
        {dialogs}
      </Page>
    );
  }

  const failed = matrix.isError || customers.isError || datasets.isError || assignments.isError || contentTypes.isError;
  const loading =
    matrix.isPending || customers.isPending || datasets.isPending || assignments.isPending || contentTypes.isPending;

  return (
    <Page>
      <PageHeader
        title="유형·교정 기준"
        description="솔루션 운영 담당자가 콘텐츠 유형과 고객사별 유효 교정 기준을 운영합니다. 1차는 유형 사용 상태와 유효 데이터셋 배정까지입니다."
      />
      <SubTabs
        label="유형·교정 기준"
        items={[
          { key: "types", label: "유형 관리" },
          { key: "assign", label: "유효 데이터셋 배정" },
          { key: "ds", label: "데이터셋 시드" },
        ]}
        value={sub}
        onChange={pickSub}
      />
      {failed ? (
        <Panel>
          <Empty
            title="기준을 불러오지 못했습니다"
            action={
              <Button
                onClick={() => {
                  void matrix.refetch();
                  void customers.refetch();
                  void datasets.refetch();
                  void assignments.refetch();
                  void contentTypes.refetch();
                }}
              >
                다시 시도
              </Button>
            }
          />
        </Panel>
      ) : loading ? (
        <Panel>
          <Empty plain title="기준을 불러오는 중입니다" />
        </Panel>
      ) : sub === "types" ? (
        <ContentTypeTable types={typeList} />
      ) : (
        <>
          <AssignMatrix
            customers={matrix.data?.content ?? []}
            datasets={dsList}
            assignments={assignments.data ?? []}
            contentTypes={typeList}
            pager={
              <Pager page={matrixPage} totalPages={matrix.data?.page.totalPages ?? 0} onPage={setMatrixPage} />
            }
          />
          {customer ? (
            <EffectiveRulesPanel
              customers={list}
              customer={customer}
              onPick={pickCustomer}
              datasets={dsList}
              assignments={assignments.data ?? []}
              contentTypes={typeList}
            />
          ) : null}
        </>
      )}
      {dialogs}
    </Page>
  );
}
