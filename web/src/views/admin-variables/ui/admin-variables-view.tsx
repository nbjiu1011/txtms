"use client";

import { Fragment, useState } from "react";
import { LIST_PAGE_SIZE, formatDateTime, useClampPage, useListPage } from "@/shared/lib";
import { Empty, Page, PageHeader, Panel } from "@/shared/ui";
import { Button, DataTable, RowLink, Select, type DataTableColumn } from "@/shared/common";
import {
  VARIABLE_TYPE_LABEL,
  logsByVariable,
  useAdminVariables,
  useProjectVariableLogs,
  type ProjectVariableLog,
  type Variable,
} from "@/entities/variable";
import { VariableDialog, variableUsageText } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-variables.module.css";

type Editing = { variable: Variable | null } | null;

/**
 * `vars` tab — project variables for the customer admin (reference J:74 `vVars`). A row opens 변수 편집, where 삭제
 * is (asked first); deleted variables stay listed with their history and do not open.
 */
export function AdminVariablesView({ context }: WorkViewProps) {
  const { projects, projectId: currentProjectId } = context;
  const [selected, setSelected] = useState<number | null>(null);
  const projectId =
    selected !== null && projects.some((p) => p.id === selected) ? selected : (currentProjectId ?? projects[0]?.id ?? null);
  // Deleted variables stay listed as 삭제 with their history (reference 삭제 (이력 보존)); one log call per project.
  const [page, setPage] = useListPage(String(projectId));
  const variables = useAdminVariables(projectId, page, LIST_PAGE_SIZE);
  useClampPage(page, variables.isPlaceholderData ? undefined : variables.data?.page.totalPages, setPage);
  const logs = useProjectVariableLogs(projectId);
  const history = logs.data ? logsByVariable(logs.data) : null;
  const [editing, setEditing] = useState<Editing>(null);
  // a deleted variable is kept for its history only: it does not open
  const edit = (v: Variable) => {
    if (!v.deleted) setEditing({ variable: v });
  };
  const columns: DataTableColumn<Variable>[] = [
    {
      id: "key",
      name: "키",
      width: "180px",
      rowAction: true,
      cell: (v) =>
        v.deleted ? (
          <span className={styles.faint}>{v.key}</span>
        ) : (
          <RowLink onClick={() => edit(v)} label={`${v.key} 편집`}>
            {v.key}
          </RowLink>
        ),
    },
    { id: "description", name: "설명", grow: 1, minWidth: "160px", wrap: true, cell: (v) => v.description },
    { id: "type", name: "자료형", width: "88px", cell: (v) => VARIABLE_TYPE_LABEL[v.type] },
    { id: "value", name: "값", width: "180px", wrap: true, cell: (v) => v.value },
    { id: "usage", name: "사용", width: "110px", cell: (v) => variableUsageText(v) },
    {
      id: "history",
      name: "이력",
      width: "200px",
      wrap: true,
      cell: (v) => <VariableHistory logs={history ? (history.get(v.id) ?? []) : null} failed={logs.isError} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="변수 관리"
        description="진행 중 문안에는 현재 값, 완료 묶음에는 완료 당시 값을 적용합니다. 변수를 누르면 편집하거나 삭제할 수 있습니다."
        actions={
          // Reference quirk kept: the full-width select wraps 변수 등록 onto the next line.
          <>
            <Select
              aria-label="프로젝트"
              value={projectId ?? ""}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button variant="pri" disabled={projectId === null} onClick={() => setEditing({ variable: null })}>
              변수 등록
            </Button>
          </>
        }
      />
      <Panel aria-busy={variables.isFetching}>
        {projectId === null ? (
          <Empty title="프로젝트가 없습니다" description="프로젝트 관리에서 프로젝트를 먼저 추가하세요." />
        ) : variables.isError ? (
          <Empty
            title="변수를 불러오지 못했습니다"
            description={variables.error.message}
            action={<Button onClick={() => void variables.refetch()}>다시 시도</Button>}
          />
        ) : (
          <DataTable
            label="변수 목록"
            columns={columns}
            data={variables.data?.content ?? []}
            onRowClick={edit}
            loading={variables.isPending}
            page={
              variables.data
                ? { number: page, size: variables.data.page.size, totalElements: variables.data.page.totalElements }
                : undefined
            }
            onPage={setPage}
            empty={<Empty title="등록된 변수가 없습니다" description="변수 등록으로 문안에 넣을 값을 추가하세요." />}
          />
        )}
      </Panel>
      {projectId !== null ? (
        <VariableDialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          projectId={projectId}
          variable={editing?.variable ?? null}
        />
      ) : null}
    </Page>
  );
}

/** 이력 cell: `{M/D HH:mm} {action}` lines, oldest first (reference). `logs` null = still loading. */
function VariableHistory({ logs, failed }: { logs: ProjectVariableLog[] | null; failed: boolean }) {
  if (failed) return <span className={styles.faint}>-</span>;
  if (!logs) return <span className={styles.faint}>…</span>;
  return (
    <span className={styles.log}>
      {logs.map((l, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {`${formatDateTime(l.at)} ${l.action}`}
        </Fragment>
      ))}
    </span>
  );
}
