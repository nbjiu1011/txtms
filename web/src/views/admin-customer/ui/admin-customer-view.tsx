"use client";

import { Page, PageHeader, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Seg } from "@/shared/common";
import { CustomerSettingsForm } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-customer.module.css";

/** `customer` tab — 고객사 설정 (reference `vCustomer`): approval stage read-only, operation settings. */
export function AdminCustomerView({ context }: WorkViewProps) {
  const { customer } = context;
  if (!customer) return null;
  const approval = customer.approvalEnabled;
  return (
    <Page>
      <PageHeader title="고객사 설정" description={customer.name} />
      <Panel className={styles.stage}>
        <PanelHeader title="승인 단계">
          <Tag variant="fill">읽기 전용</Tag>
        </PanelHeader>
        <PanelBody>
          <div className={styles.row}>
            <fieldset disabled className={styles.segSet}>
              <Seg
                label="승인 단계"
                options={[
                  { key: "on", label: "사용" },
                  { key: "off", label: "사용 안 함" },
                ]}
                value={approval ? "on" : "off"}
                onChange={() => undefined}
              />
            </fieldset>
            <span className={styles.mutedSmall}>제품 도입 시 확정한 값이며 사용 중에는 바꿀 수 없습니다.</span>
          </div>
          <p className={styles.final}>
            최종 완료 상태: <b>{approval ? "승인 완료" : "검수 완료"}</b>.{" "}
            {approval
              ? "주담당 검수 완료 후 승인 대기로 넘어가고, 프로젝트 승인자 한 명이 최종 승인합니다."
              : "주담당 검수자가 검수를 완료하면 바로 최종 완료됩니다."}
          </p>
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="운영 설정" />
        <PanelBody>
          <CustomerSettingsForm key={customer.id} customer={customer} />
        </PanelBody>
      </Panel>
    </Page>
  );
}
