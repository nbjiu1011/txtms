"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Icon, Page, PageHeader, Panel, Table, Tag, tableClasses, toast } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { opsApi, useOpsCustomers, type OpsCustomer } from "@/entities/ops";
import {
  CreateCustomerDialog,
  DeactivateCustomerDialog,
  consumeOpsIntent,
  continueToSetup,
  invalidateOps,
  useOpsIntent,
} from "@/features/ops-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import { OpsAuditPanel } from "./ops-audit-panel";
import { CustomerDetail } from "./customer-detail";
import styles from "./ops-customers.module.css";

/** `opsCust` tab — 고객사 관리 (reference `vOpsCust`): list, detail of the selected customer, 운영 이력. */
export function OpsCustomersView({ context, openTab }: WorkViewProps) {
  const client = useQueryClient();
  const customers = useOpsCustomers();
  const intent = useOpsIntent("opsCustomers");
  const [picked, setPicked] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<OpsCustomer | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const list = customers.data ?? [];
  const wanted = intent?.customerId ?? picked ?? context.customerId;
  const selected = list.find((c) => c.id === wanted) ?? list[0] ?? null;

  const select = (id: number) => {
    consumeOpsIntent("opsCustomers");
    setPicked(id);
  };

  const reactivate = async (c: OpsCustomer) => {
    setBusyId(c.id);
    try {
      await opsApi.reactivateCustomer(c.id);
      await invalidateOps(client);
      toast("사용 상태로 돌렸습니다");
    } catch (error) {
      toast(error instanceof Error ? error.message : "사용 재개하지 못했습니다");
    } finally {
      setBusyId(null);
    }
  };

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
        ) : list.length === 0 ? (
          <Empty title="등록된 고객사가 없습니다" description="고객사 생성으로 첫 고객사를 등록하세요." />
        ) : (
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
              {list.map((c) => (
                <tr
                  key={c.id}
                  className={cn(c.id === selected?.id && styles.selected)}
                  aria-selected={c.id === selected?.id}
                >
                  <td className={tableClasses.ttl}>
                    <button type="button" className={styles.nameBtn} onClick={() => select(c.id)}>
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
                    {c.active ? (
                      <Button size="sm" variant="ghost" onClick={() => setDeactivating(c)}>
                        비활성
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busyId === c.id} onClick={() => void reactivate(c)}>
                        사용 재개
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {selected ? (
        <CustomerDetail
          customer={selected}
          onOpenSetup={() => continueToSetup(selected.id, openTab)}
        />
      ) : null}
      <OpsAuditPanel customers={list} />
      <CreateCustomerDialog
        open={creating}
        onClose={() => setCreating(false)}
        customers={list}
        onCreated={(customer) => {
          select(customer.id);
          continueToSetup(customer.id, openTab);
        }}
      />
      <DeactivateCustomerDialog open={deactivating !== null} onClose={() => setDeactivating(null)} customer={deactivating} />
    </Page>
  );
}
