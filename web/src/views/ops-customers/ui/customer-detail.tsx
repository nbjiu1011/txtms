"use client";

import { formatDate } from "@/shared/lib";
import { Button, KeyValueList, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { NOTIFY_CHANNEL_LABEL } from "@/entities/customer";
import type { Me } from "@/entities/me";
import type { OpsCustomer } from "@/entities/ops";
import { useCustomerProjects } from "@/entities/project";
import { useUserDirectory } from "@/entities/user";
import styles from "./ops-customers.module.css";

export interface CustomerDetailProps {
  customer: OpsCustomer;
  me: Me;
  onOpenSetup: () => void;
}

/**
 * Selected customer (reference `CustomerDetailPanel`). The reference's right column held the Phase 2
 * support-access panel and stays empty after its removal; here the grid shows 상세 next to 프로젝트·요청.
 */
export function CustomerDetail({ customer, me, onOpenSetup }: CustomerDetailProps) {
  const projects = useCustomerProjects(customer.id);
  const users = useUserDirectory(customer.id);
  // The creator is an operator (not a customer user): only the current operator's name is known here.
  const creator = customer.createdBy === me.id ? me.name : "";
  const list = projects.data ?? [];

  return (
    <div className={styles.grid}>
      <Panel>
        <PanelHeader title={`${customer.name} 상세`}>
          <span className={styles.headMeta}>
            {formatDate(customer.createdAt)} 등록{creator ? `  ${creator}` : ""}
          </span>
        </PanelHeader>
        <PanelBody>
          <KeyValueList
            items={[
              {
                label: "회사 도메인",
                value: (
                  <>
                    {customer.domain} <span className={styles.smallFaint}>외부 도메인 초대 시 경고</span>
                  </>
                ),
              },
              {
                label: "승인 단계",
                value: (
                  <>
                    {customer.approvalEnabled ? "사용 (최종 상태: 승인 완료)" : "미사용 (최종 상태: 검수 완료)"}{" "}
                    <span className={styles.smallFaint}>도입 시 확정, 운영 중 변경 불가</span>
                  </>
                ),
              },
              {
                label: "고객사 관리자",
                value: customer.admins.length ? (
                  customer.admins.map((u) => (
                    <div key={u.id}>
                      {u.name} <span className={styles.smallFaint}>{u.email}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <Tag variant="hot">미지정</Tag> 초기 설정에서 지정하세요
                  </>
                ),
              },
              {
                label: "운영 설정",
                value: (
                  <>
                    알림 {NOTIFY_CHANNEL_LABEL[customer.notifyChannel]}, 납기 임박 D-{customer.dueSoonDays}{" "}
                    <span className={styles.smallFaint}>고객사 관리자가 변경</span>
                  </>
                ),
              },
              {
                label: "상태",
                value: customer.active ? (
                  "사용"
                ) : (
                  <>
                    <Tag variant="hot">비활성</Tag> {customer.deactivationReason ?? ""}
                  </>
                ),
              },
            ]}
          />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="프로젝트·요청">
          <Button size="sm" className={styles.headBtn} onClick={onOpenSetup}>
            초기 설정 열기
          </Button>
        </PanelHeader>
        <PanelBody>
          <KeyValueList
            items={[
              {
                label: "프로젝트",
                value: list.length ? (
                  list.map((p) => (
                    <div key={p.id}>
                      {p.name}{" "}
                      <span className={styles.smallFaint}>
                        대표 {p.leadUserId ? users.name(p.leadUserId) : "미지정"}
                        {p.active ? "" : ", 중지"}
                      </span>
                    </div>
                  ))
                ) : projects.isPending ? (
                  <span className={styles.faint}>불러오는 중입니다</span>
                ) : customer.projectCount ? (
                  <span className={styles.faint}>{customer.projectCount}개 (비활성 고객사는 목록을 열람하지 않습니다)</span>
                ) : (
                  <span className={styles.faint}>없음</span>
                ),
              },
              {
                label: "요청",
                value: `전체 ${customer.requestCount}건, 진행 중 ${customer.activeRequestCount}건, 완료 ${customer.completedRequestCount}건`,
              },
              {
                label: "샘플",
                value: customer.sample ? (
                  <>
                    샘플 요청 {customer.sampleRequestCount}건 <Tag>샘플 고객사</Tag>
                  </>
                ) : (
                  <span className={styles.faint}>샘플 고객사가 아닙니다</span>
                ),
              },
              { label: "사용자", value: `${customer.userCount}명 (초대 대기·비활성 포함)` },
            ]}
          />
          <p className={styles.note}>운영 담당자는 요청 수만 봅니다. 고객사 콘텐츠는 조회하지 않습니다.</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
