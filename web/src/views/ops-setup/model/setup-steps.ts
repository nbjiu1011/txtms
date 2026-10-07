import type { OpsCustomer } from "@/entities/ops";
import type { Project } from "@/entities/project";
import { CONTENT_TYPE_LABEL } from "@/entities/request";

export interface SetupStep {
  key: "admin" | "project" | "members" | "datasets";
  title: string;
  done: boolean;
  status: string;
}

/** 요청자 / 검수자 / 승인자 counts summed per project (reference `vOpsSeed` step 3). */
export function memberCounts(projects: Project[]): { requesters: number; reviewers: number; approvers: number } {
  let requesters = 0;
  let reviewers = 0;
  let approvers = 0;
  for (const p of projects) {
    for (const m of p.members) {
      if (m.roles.includes("REQUESTER")) requesters++;
      if (m.roles.includes("REVIEWER")) reviewers++;
      if (m.roles.includes("APPROVER")) approvers++;
    }
  }
  return { requesters, reviewers, approvers };
}

/** The four initial setup steps of a customer (reference `SetupStepsPanel`). */
export function setupSteps(customer: OpsCustomer, projects: Project[]): SetupStep[] {
  const counts = memberCounts(projects);
  const anyMember = projects.some((p) => p.members.some((m) => m.roles.length > 0));
  return [
    {
      key: "admin",
      title: "고객사 관리자 지정",
      done: customer.adminAssigned,
      status: customer.admins.length
        ? customer.admins.map((u) => u.name).join(", ")
        : "아직 없습니다. 관리자를 먼저 초대하세요.",
    },
    {
      key: "project",
      title: "초기 프로젝트",
      done: projects.length > 0,
      status: projects.length
        ? `${projects.length}개 (${projects.map((p) => p.name).join(", ")})`
        : "프로젝트가 없습니다.",
    },
    {
      key: "members",
      title: "업무 사용자",
      done: anyMember,
      status:
        `요청자 ${counts.requesters}명, 검수자 ${counts.reviewers}명` +
        (customer.approvalEnabled ? `, 승인자 ${counts.approvers}명` : ""),
    },
    {
      key: "datasets",
      title: "유효 데이터셋 연결",
      done: customer.unassignedDatasetTypes.length === 0,
      status: customer.unassignedDatasetTypes.length
        ? `미배정 ${customer.unassignedDatasetTypes.map((t) => CONTENT_TYPE_LABEL[t]).join(", ")}`
        : "모든 유형에 배정되었습니다.",
    },
  ];
}
