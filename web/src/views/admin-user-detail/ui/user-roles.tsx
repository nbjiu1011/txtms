import { Empty } from "@/shared/ui";
import { DataTable, type DataTableColumn } from "@/shared/common";
import { LEAD_ROLE_LABEL, PROJECT_ROLE_LABEL, type Project } from "@/entities/project";
import type { Member } from "@/entities/user";

type Participation = Member["projects"][number];

export interface UserRolesProps {
  member: Member;
  projects: Project[];
}

/** The user's roles per project (no row click: roles change in 역할 관리 above). */
export function UserRoles({ member, projects }: UserRolesProps) {
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name ?? `프로젝트 ${id}`;
  const columns: DataTableColumn<Participation>[] = [
    { id: "project", name: "프로젝트", width: "240px", cell: (p) => projectName(p.projectId) },
    {
      id: "roles",
      name: "역할",
      grow: 1,
      minWidth: "200px",
      cell: (p) => [...p.roles.map((r) => PROJECT_ROLE_LABEL[r]), ...(p.lead ? [LEAD_ROLE_LABEL] : [])].join(", "),
    },
  ];
  return (
    <DataTable
      label="프로젝트별 역할"
      columns={columns}
      data={member.projects}
      keyField="projectId"
      empty={<Empty plain title="참여 중인 프로젝트가 없습니다" description="역할 관리에서 프로젝트 역할을 지정하세요." />}
    />
  );
}
