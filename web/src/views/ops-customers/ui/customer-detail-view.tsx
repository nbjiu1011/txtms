"use client";

import { useEffect, useState } from "react";
import { isApiError } from "@/shared/api";
import { Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button } from "@/shared/common";
import { useOpsCustomer, useOpsSetupContext } from "@/entities/ops";
import { DeactivateCustomerDialog, continueToSetup } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useCustomerStatus } from "../model/use-customer-status";
import { CustomerSummary } from "./customer-detail";
import { CustomerMembersPanel } from "./customer-members-panel";
import { CustomerProjectsPanel } from "./customer-projects-panel";
import { OpsAuditPanel } from "./ops-audit-panel";
import styles from "./ops-customers.module.css";

/**
 * `opsCustomer` tab — 고객사 상세: 기본 정보·현황, the customer's projects and users (server paged) and its
 * 운영 이력. The header holds the status actions (비활성화 after a confirm with the impact, 사용 재개 at once).
 * Inactive customers stay readable; writes go through 초기 설정·시드.
 */
export function OpsCustomerDetailView({ tab, openTab, setTitle }: WorkViewProps) {
  const id = Number(tab.params.id);
  const customerId = Number.isInteger(id) && id > 0 ? id : null;
  const customer = useOpsCustomer(customerId);
  // names of the project and user columns (reference data of the customer, not a list)
  const refs = useOpsSetupContext(customerId);
  const status = useCustomerStatus();
  const [deactivating, setDeactivating] = useState(false);
  const name = customer.data?.name ?? null;

  useEffect(() => {
    setTitle(name);
  }, [name, setTitle]);

  const toList = () => openTab({ route: "opsCustomers", params: {} });
  const back = <Button onClick={toList}>목록</Button>;

  if (customerId === null || customer.isPending || customer.isError) {
    const missing = customerId === null || (customer.isError && isApiError(customer.error) && customer.error.status === 404);
    return (
      <Page>
        <PageHeader title="고객사 상세" actions={back} />
        <Panel>
          {missing ? (
            <Empty title="고객사를 찾을 수 없습니다" description="목록에서 고객사를 다시 선택하세요." action={back} />
          ) : customer.isError ? (
            <Empty
              title="고객사를 불러오지 못했습니다"
              description={customer.error.message}
              action={<Button onClick={() => void customer.refetch()}>다시 시도</Button>}
            />
          ) : (
            <Empty plain title="고객사를 불러오는 중입니다" />
          )}
        </Panel>
      </Page>
    );
  }

  const c = customer.data;
  const userName = (userId: number) => refs.data?.members.find((m) => m.user.id === userId)?.user.name ?? null;
  const projectName = (projectId: number) => refs.data?.projects.find((p) => p.id === projectId)?.name ?? null;

  return (
    <Page aria-busy={customer.isFetching}>
      <PageHeader
        title={c.name}
        description={`${c.domain} · ${c.active ? "사용 중" : "비활성"} 고객사입니다. 운영 담당자는 요청 수만 보고 콘텐츠는 조회하지 않습니다.`}
        actions={
          <div className={styles.rowActions}>
            {back}
            <Button onClick={() => continueToSetup(c.id, openTab)}>초기 설정 열기</Button>
            {c.active ? (
              <Button variant="warn" onClick={() => setDeactivating(true)}>
                비활성화
              </Button>
            ) : (
              <Button variant="pri" disabled={status.busyId === c.id} onClick={() => void status.reactivate(c)}>
                사용 재개
              </Button>
            )}
          </div>
        }
      />
      <CustomerSummary customer={c} />
      <CustomerProjectsPanel customerId={c.id} userName={userName} />
      <CustomerMembersPanel customerId={c.id} projectName={projectName} />
      <OpsAuditPanel customerId={c.id} />
      <DeactivateCustomerDialog open={deactivating} onClose={() => setDeactivating(false)} customer={deactivating ? c : null} />
    </Page>
  );
}
