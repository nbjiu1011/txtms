"use client";

import { Empty, Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { RequestStatusChip, type RequestSummary } from "@/entities/request";
import { useDeactivationImpact } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./user-detail.module.css";

export interface UserWorkProps {
  customerId: number;
  userId: number;
  openTab: WorkViewProps["openTab"];
}

/** 진행 업무 — reviews and own requests in progress and lead projects (the deactivation impact, contract §11). */
export function UserWork({ customerId, userId, openTab }: UserWorkProps) {
  const impact = useDeactivationImpact(customerId, userId);
  const rows = (title: string, list: RequestSummary[]) =>
    list.length ? (
      <div className={styles.workGroup}>
        <h4>{`${title} ${list.length}건`}</h4>
        <ul className={styles.work}>
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={styles.link}
                onClick={() => openTab({ route: "request", params: { id: r.id } })}
              >
                <span className="tabular">{r.id}</span> {r.title || "(제목 없음)"}
              </button>
              <RequestStatusChip status={r.status} />
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <Panel className={styles.block} aria-busy={impact.isFetching}>
      <PanelHeader title="진행 업무" note="비활성화나 역할 해제 전에 인수인계할 업무입니다" />
      <PanelBody>
        {impact.isPending ? (
          <Empty plain title="진행 업무를 불러오는 중입니다" />
        ) : impact.isError ? (
          <Empty plain title="진행 업무를 불러오지 못했습니다" description={impact.error.message} />
        ) : impact.data.reviewing.length + impact.data.requesting.length + impact.data.leadProjects.length === 0 ? (
          <p className={styles.faint}>진행 중인 업무가 없습니다.</p>
        ) : (
          <>
            {rows("검수 중", impact.data.reviewing)}
            {rows("요청 중", impact.data.requesting)}
            {impact.data.leadProjects.length ? (
              <div className={styles.workGroup}>
                <h4>대표 검수자</h4>
                <p>{impact.data.leadProjects.map((p) => p.name).join(", ")}</p>
              </div>
            ) : null}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
