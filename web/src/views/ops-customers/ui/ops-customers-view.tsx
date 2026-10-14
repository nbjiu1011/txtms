"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage } from "@/shared/lib";
import { Empty, Icon, Page, PageHeader, Panel } from "@/shared/ui";
import { Button } from "@/shared/common";
import { useOpsCustomerOptions, useOpsCustomers, type OpsCustomer } from "@/entities/ops";
import { CreateCustomerDialog, continueToSetup } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { CustomerTable } from "./customer-table";
import { OpsAuditPanel } from "./ops-audit-panel";
import styles from "./ops-customers.module.css";

/**
 * `opsCustomers` tab — 고객사 관리 목록 (server paged); a row opens the customer detail tab, where 비활성화 and
 * 사용 재개 live.
 */
export function OpsCustomersView({ openTab }: WorkViewProps) {
  const [page, setPage] = useState(0);
  const customers = useOpsCustomers(page, LIST_PAGE_SIZE);
  const options = useOpsCustomerOptions();
  const [creating, setCreating] = useState(false);
  useClampPage(page, customers.isPlaceholderData ? undefined : customers.data?.page.totalPages, setPage);

  const openDetail = (c: Pick<OpsCustomer, "id">) => openTab({ route: "opsCustomer", params: { id: String(c.id) } });

  return (
    <Page>
      <PageHeader
        title="고객사 관리"
        description="솔루션 운영 담당자가 고객사를 등록하고 상태를 관리합니다. 고객사를 누르면 상세가 열립니다. 이력이 연결된 고객사는 삭제하지 않고 비활성으로 보존합니다."
        actions={
          <Button variant="pri" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            고객사 생성
          </Button>
        }
      />
      <Panel className={styles.block} aria-busy={customers.isFetching}>
        {customers.isError ? (
          <Empty
            title="고객사를 불러오지 못했습니다"
            description={customers.error.message}
            action={<Button onClick={() => void customers.refetch()}>다시 시도</Button>}
          />
        ) : (
          <CustomerTable
            rows={customers.data?.content ?? []}
            onOpen={openDetail}
            loading={customers.isPending}
            page={
              customers.data
                ? { number: page, size: customers.data.page.size, totalElements: customers.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            empty={<Empty title="등록된 고객사가 없습니다" description="고객사 생성으로 첫 고객사를 등록하세요." />}
          />
        )}
      </Panel>
      <OpsAuditPanel customers={options.data ?? []} />
      <CreateCustomerDialog
        open={creating}
        onClose={() => setCreating(false)}
        customers={options.data ?? []}
        onCreated={(customer) => continueToSetup(customer.id, openTab)}
      />
    </Page>
  );
}
