"use client";

import { useState } from "react";
import { Empty, Page, PageHeader, Seg, SubTabs } from "@/shared/ui";
import { projectRoles } from "@/entities/me";
import { useRequestActionIntent } from "@/entities/request";
import { useUserDirectory } from "@/entities/user";
import type { WorkViewProps } from "@/widgets/app-shell";
import { reviewSubTabs, type MineFilter, type ReviewSub } from "../model/review-rows";
import { AssignManagement } from "./assign-management";
import { MyReviewTable } from "./my-review-table";
import styles from "./review.module.css";

const SUB_LABEL: Record<ReviewSub, string> = { mine: "내 검수", assign: "배정 관리" };

/** `review` tab — 내 검수 (assigned reviewers) and 배정 관리 (lead reviewer). */
export function ReviewView({ me, context, openTab }: WorkViewProps) {
  const { projectId, customerId, project } = context;
  const roles = projectRoles(me, projectId);
  const lead = roles.includes("LEAD");
  const subs = reviewSubTabs({ reviewer: roles.includes("REVIEWER"), lead });
  const [sub, setSub] = useState<ReviewSub>(lead ? "assign" : "mine");
  const [filter, setFilter] = useState<MineFilter>("active");
  const users = useUserDirectory(customerId);
  const current = subs.includes(sub) ? sub : (subs[0] ?? "mine");
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });

  if (projectId === null || subs.length === 0) {
    return (
      <Page wide>
        <PageHeader title="검수" />
        <Empty title="검수할 프로젝트가 없습니다" description="검수자 또는 대표 검수자 역할이 있는 프로젝트를 선택하세요." />
      </Page>
    );
  }

  return (
    <Page wide>
      <PageHeader
        title="검수"
        description={`${project?.name ?? ""} 프로젝트. ${
          lead
            ? "대표 검수자로서 배정 대기 요청에 검수자를 배정하고 주담당을 지정합니다."
            : "배정된 요청을 검수합니다."
        }`}
      />
      <SubTabs
        label="검수"
        items={subs.map((key) => ({ key, label: SUB_LABEL[key] }))}
        value={current}
        onChange={setSub}
      />
      {current === "mine" ? (
        <>
          <Seg
            label="내 검수 범위"
            className={styles.seg}
            options={[
              { key: "active", label: "진행 중" },
              { key: "done", label: "완료" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <MyReviewTable projectId={projectId} meId={me.id} filter={filter} onOpen={openRequest} />
        </>
      ) : (
        <AssignManagement
          projectId={projectId}
          users={users}
          onOpen={openRequest}
          onAssign={(id) => {
            useRequestActionIntent.getState().request(id, "ASSIGN");
            openRequest(id);
          }}
        />
      )}
    </Page>
  );
}
