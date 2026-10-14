"use client";

import { Empty, Panel, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import type { Project } from "@/entities/project";
import styles from "./ops-setup.module.css";

export interface TemplatePanelProps {
  projects: Project[];
  loading: boolean;
  /** Inactive customer: its projects are listed (operator API) but cannot be changed. */
  inactive: boolean;
  onEdit: (project: Project) => void;
}

/**
 * 프로젝트 알림톡 템플릿 (not in the reference): the 알림톡 template codes each project's 알림톡
 * contents are checked against on submission; the one row action edits them.
 */
export function TemplatePanel({ projects, loading, inactive, onEdit }: TemplatePanelProps) {
  const columns: DataTableColumn<Project>[] = [
    { id: "name", name: "프로젝트", width: "220px", cell: (p) => <b>{p.name}</b> },
    {
      id: "templates",
      name: "알림톡 템플릿",
      grow: 1,
      minWidth: "200px",
      wrap: true,
      cell: (p) =>
        p.templates.length ? (
          <span>
            {p.templates.slice(0, 3).map((t) => t.code).join(", ")}
            {p.templates.length > 3 ? ` 외 ${p.templates.length - 3}개` : ""}
          </span>
        ) : (
          <span className={styles.faint}>없음</span>
        ),
    },
    { id: "status", name: "상태", width: "80px", cell: (p) => (p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>) },
    {
      id: "edit",
      name: <span className={styles.sr}>편집</span>,
      width: "128px",
      rowAction: true,
      cell: (p) => (
        <Button
          size="sm"
          disabled={inactive}
          title={inactive ? "비활성 고객사입니다. 사용 재개 후 알림톡 템플릿을 설정하세요." : undefined}
          onClick={() => onEdit(p)}
        >
          알림톡 템플릿
        </Button>
      ),
    },
  ];
  return (
    <Panel className={styles.block}>
      <PanelHeader title="프로젝트 알림톡 템플릿" note="알림톡은 등록한 템플릿 코드와 같아야 검수 요청할 수 있습니다" />
      <DataTable
        label="프로젝트 알림톡 템플릿"
        columns={columns}
        data={projects}
        loading={loading}
        empty={
          <Empty
            plain
            title="프로젝트가 없습니다"
            description={inactive ? undefined : "초기 프로젝트를 먼저 만드세요."}
          />
        }
      />
    </Panel>
  );
}
