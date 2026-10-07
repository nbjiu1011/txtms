"use client";

import { Fragment, useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, Empty, Page, PageHeader, Panel, Select, Table } from "@/shared/ui";
import {
  VARIABLE_TYPE_LABEL,
  useProjectVariables,
  useVariableLogs,
  type Variable,
} from "@/entities/variable";
import { VariableDialog, useDeleteVariable, variableUsageText } from "@/features/customer-admin";
import type { WorkViewProps } from "@/widgets/app-shell";
import styles from "./admin-variables.module.css";

type Editing = { variable: Variable | null } | null;

/** `vars` tab — project variables for the customer admin (reference J:74 `vVars`). */
export function AdminVariablesView({ context }: WorkViewProps) {
  const { projects, projectId: currentProjectId } = context;
  const [selected, setSelected] = useState<number | null>(null);
  const projectId =
    selected !== null && projects.some((p) => p.id === selected) ? selected : (currentProjectId ?? projects[0]?.id ?? null);
  const variables = useProjectVariables(projectId);
  const [editing, setEditing] = useState<Editing>(null);
  const deletion = useDeleteVariable();

  return (
    <Page wide>
      <PageHeader
        title="변수 관리"
        description="진행 중 문안에는 현재 값, 완료 묶음에는 완료 당시 값을 적용합니다."
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
        ) : variables.isPending ? (
          <Empty plain title="변수를 불러오는 중입니다" />
        ) : variables.isError ? (
          <Empty
            title="변수를 불러오지 못했습니다"
            description={variables.error.message}
            action={<Button onClick={() => void variables.refetch()}>다시 시도</Button>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>키</th>
                  <th>설명</th>
                  <th>자료형</th>
                  <th>값</th>
                  <th>사용</th>
                  <th>이력</th>
                  <th>
                    <span className={styles.sr}>관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variables.data.map((v) => (
                  <tr key={v.id}>
                    <td>{v.key}</td>
                    <td>{v.description}</td>
                    <td>{VARIABLE_TYPE_LABEL[v.type]}</td>
                    <td>{v.value}</td>
                    <td>{variableUsageText(v)}</td>
                    <td>
                      <VariableHistory id={v.id} />
                    </td>
                    <td className={styles.actions}>
                      <Button size="sm" onClick={() => setEditing({ variable: v })}>
                        편집
                      </Button>
                      <Button
                        size="sm"
                        variant="warn"
                        disabled={v.inUse || deletion.busyId === v.id}
                        title={v.inUse ? "사용 중인 변수는 삭제할 수 없습니다" : undefined}
                        onClick={() => void deletion.remove(v)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {variables.data.length === 0 ? <Empty title="등록된 변수가 없습니다" /> : null}
          </>
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

/** 이력 cell: `{M/D HH:mm} {action}` lines (reference). */
function VariableHistory({ id }: { id: number }) {
  const logs = useVariableLogs(id);
  if (logs.isPending) return <span className={styles.faint}>…</span>;
  if (logs.isError) return <span className={styles.faint}>-</span>;
  return (
    <>
      {logs.data.map((l, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {`${formatDateTime(l.at)} ${l.action}`}
        </Fragment>
      ))}
    </>
  );
}
