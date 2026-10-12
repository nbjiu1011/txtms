"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, useClampPage } from "@/shared/lib";
import { Button, Empty, Icon, Page, PageHeader, Pager, Panel, Table, Tag, tableClasses } from "@/shared/ui";
import { useOpsCustomerOptions, useOpsCustomers, type OpsCustomer } from "@/entities/ops";
import { CreateCustomerDialog, DeactivateCustomerDialog, continueToSetup } from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { useCustomerStatus } from "../model/use-customer-status";
import { OpsAuditPanel } from "./ops-audit-panel";
import styles from "./ops-customers.module.css";

/** `opsCustomers` tab — 고객사 관리 목록 (server paged); a customer name opens its detail tab. */
export function OpsCustomersView({ openTab }: WorkViewProps) {
  const [page, setPage] = useState(0);
  const customers = useOpsCustomers(page, LIST_PAGE_SIZE);
  const options = useOpsCustomerOptions();
  const status = useCustomerStatus();
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<OpsCustomer | null>(null);
  const rows = customers.data?.content ?? [];
  const totalPages = customers.data?.page.totalPages ?? 0;
  useClampPage(page, customers.isPlaceholderData ? undefined : customers.data?.page.totalPages, setPage);

  const openDetail = (c: Pick<OpsCustomer, "id">) => openTab({ route: "opsCustomer", params: { id: String(c.id) } });

  return (
    <Page wide>
      <PageHeader
        title="고객사 관리"
        description="솔루션 운영 담당자가 고객사를 등록하고 상태를 관리합니다. 이력이 연결된 고객사는 삭제하지 않고 비활성으로 보존합니다."
        actions={
          <Button variant="pri" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            고객사 생성
          </Button>
        }
      />
      <Panel className={styles.block} aria-busy={customers.isFetching}>
        {customers.isPending ? (
          <Empty plain title="고객사를 불러오는 중입니다" />
        ) : customers.isError ? (
          <Empty
            title="고객사를 불러오지 못했습니다"
            description={customers.error.message}
            action={<Button onClick={() => void customers.refetch()}>다시 시도</Button>}
          />
        ) : customers.data.page.totalElements === 0 ? (
          <Empty title="등록된 고객사가 없습니다" description="고객사 생성으로 첫 고객사를 등록하세요." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>고객사</th>
                  <th>승인 단계</th>
                  <th>프로젝트</th>
                  <th>사용자</th>
                  <th>고객사 관리자</th>
                  <th>진행 중 요청</th>
                  <th>유효 데이터셋</th>
                  <th>상태</th>
                  <th>
                    <span className={styles.sr}>작업</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className={tableClasses.ttl}>
                      <button
                        type="button"
                        className={styles.nameBtn}
                        aria-label={`${c.name} 상세 보기`}
                        onClick={() => openDetail(c)}
                      >
                        {c.name}
                      </button>
                      <div className={styles.domain}>{c.domain}</div>
                    </td>
                    <td>{c.approvalEnabled ? <Tag variant="fill">승인 단계 사용</Tag> : <Tag>미사용</Tag>}</td>
                    <td className={styles.num}>{c.projectCount}</td>
                    <td className={styles.num}>{c.userCount}</td>
                    <td>{c.admins.length ? c.admins.map((u) => u.name).join(", ") : <Tag variant="hot">미지정</Tag>}</td>
                    <td className={styles.num}>{c.activeRequestCount}</td>
                    <td>
                      {c.unassignedDatasetTypes.length ? (
                        <Tag variant="hot">{c.unassignedDatasetTypes.length}개 조합 미배정</Tag>
                      ) : (
                        <Tag>완료</Tag>
                      )}
                    </td>
                    <td>{c.active ? <Tag>사용</Tag> : <Tag variant="hot">비활성</Tag>}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button size="sm" onClick={() => openDetail(c)}>
                          상세
                        </Button>
                        {c.active ? (
                          <Button size="sm" variant="ghost" onClick={() => setDeactivating(c)}>
                            비활성
                          </Button>
                        ) : (
                          <Button size="sm" disabled={status.busyId === c.id} onClick={() => void status.reactivate(c)}>
                            사용 재개
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </Panel>
      <OpsAuditPanel customers={options.data ?? []} />
      <CreateCustomerDialog
        open={creating}
        onClose={() => setCreating(false)}
        customers={options.data ?? []}
        onCreated={(customer) => continueToSetup(customer.id, openTab)}
      />
      <DeactivateCustomerDialog open={deactivating !== null} onClose={() => setDeactivating(null)} customer={deactivating} />
    </Page>
  );
}
