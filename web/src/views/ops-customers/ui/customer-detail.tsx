"use client";

import { formatDate } from "@/shared/lib";
import { KeyValueList, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { NOTIFY_CHANNEL_LABEL } from "@/entities/customer";
import { unassignedText, type OpsCustomer } from "@/entities/ops";
import styles from "./ops-customers.module.css";

export interface CustomerSummaryProps {
  customer: OpsCustomer;
}

/** 기본 정보 + 현황 of the customer detail page (reference `CustomerDetailPanel`, numbers only). */
export function CustomerSummary({ customer }: CustomerSummaryProps) {
  const creator = customer.createdByName ?? "";
  return (
    <div className={styles.grid}>
      <Panel>
        <PanelHeader title="기본 정보">
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
        <PanelHeader title="현황" />
        <PanelBody>
          <KeyValueList
            items={[
              { label: "프로젝트", value: `${customer.projectCount}개 (사용 중지 포함)` },
              { label: "사용자", value: `${customer.userCount}명 (초대 대기·비활성 포함)` },
              {
                label: "요청",
                value: `전체 ${customer.requestCount}건, 진행 중 ${customer.activeRequestCount}건, 완료 ${customer.completedRequestCount}건`,
              },
              {
                label: "유효 데이터셋",
                value: customer.unassignedDatasetTypes.length ? (
                  <Tag variant="hot">미배정 {unassignedText(customer)}</Tag>
                ) : (
                  "모든 사용 유형 배정 완료"
                ),
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
            ]}
          />
          <p className={styles.note}>운영 담당자는 요청 수만 봅니다. 고객사 콘텐츠는 조회하지 않습니다.</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
