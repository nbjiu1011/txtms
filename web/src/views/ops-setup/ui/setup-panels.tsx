"use client";

import { cn } from "@/shared/lib";
import { Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, type DataTableColumn } from "@/shared/common";
import {
  ASSIGNABLE_TYPES,
  assignmentOf,
  latestDataset,
  type Dataset,
  type DatasetAssignment,
  type OpsCustomer,
} from "@/entities/ops";
import { CONTENT_TYPE_LABEL, type ContentType, type ContentTypeSetting } from "@/entities/request";
import type { SetupStep } from "../model/setup-steps";
import styles from "./ops-setup.module.css";

export interface SetupStepsPanelProps {
  steps: SetupStep[];
  onInviteAdmin: () => void;
  onCreateProject: () => void;
  onInviteMember: () => void;
  onOpenAssign: () => void;
}

/** 초기 프로젝트·사용자 (reference `SetupStepsPanel`): four steps, a left rule marks the done ones. */
export function SetupStepsPanel({ steps, onInviteAdmin, onCreateProject, onInviteMember, onOpenAssign }: SetupStepsPanelProps) {
  const action: Record<SetupStep["key"], { label: string; run: () => void }> = {
    admin: { label: "관리자 초대", run: onInviteAdmin },
    project: { label: "프로젝트 생성", run: onCreateProject },
    members: { label: "사용자 초대", run: onInviteMember },
    datasets: { label: "배정 화면", run: onOpenAssign },
  };
  return (
    <Panel>
      <PanelHeader title="초기 프로젝트·사용자">
        <Tag>E-12.1</Tag>
      </PanelHeader>
      <PanelBody>
        <ol className={styles.steps} aria-label="초기 설정 단계">
          {steps.map((s) => (
            <li key={s.key} className={cn(styles.step, s.done && styles.done)}>
              <b>
                {s.title}
                {s.done ? <span className={styles.doneMark}> 완료</span> : null}
              </b>
              <span>{s.status}</span>
              <Button size="sm" onClick={action[s.key].run}>
                {action[s.key].label}
              </Button>
            </li>
          ))}
        </ol>
      </PanelBody>
    </Panel>
  );
}

export interface RuleSeedPanelProps {
  customer: OpsCustomer;
  datasets: Dataset[];
  assignments: DatasetAssignment[];
  contentTypes: ContentTypeSetting[];
  onSeed: (type: ContentType, latest: Dataset) => void;
  onRegister: () => void;
}

/** One content type of the customer: the assigned dataset next to the newest registered version. */
interface SeedRow {
  type: ContentType;
  current: Dataset | null;
  latest: Dataset | null;
  off: boolean;
  upToDate: boolean;
}

/**
 * 유형별 교정 규칙 시드 (reference `RuleSeedPanel`): the assigned dataset of each content type of the
 * customer next to the newest registered version; the one row action seeds the newest version.
 */
export function RuleSeedPanel({ customer, datasets, assignments, contentTypes, onSeed, onRegister }: RuleSeedPanelProps) {
  const rows: SeedRow[] = ASSIGNABLE_TYPES.map((type) => {
    const assignment = assignmentOf(assignments, customer.id, type);
    const current = assignment ? (datasets.find((d) => d.id === assignment.datasetId) ?? null) : null;
    const latest = latestDataset(datasets, type);
    const off = contentTypes.find((t) => t.type === type)?.active === false;
    return { type, current, latest, off, upToDate: !!current && !!latest && current.id === latest.id };
  });
  const columns: DataTableColumn<SeedRow>[] = [
    { id: "type", name: "유형", width: "96px", cell: (r) => <b>{CONTENT_TYPE_LABEL[r.type]}</b> },
    {
      id: "current",
      name: "배정된 유효 데이터셋",
      grow: 1,
      minWidth: "130px",
      cell: (r) =>
        r.current ? (
          <span>
            v{r.current.version} <span className={styles.smallFaint}>규칙 {r.current.ruleCount}개</span>
          </span>
        ) : (
          <Tag variant="hot">미배정</Tag>
        ),
    },
    {
      id: "latest",
      name: "최신 배포본",
      width: "92px",
      cell: (r) => (r.latest ? `v${r.latest.version}` : <span className={styles.faint}>배포본 없음</span>),
    },
    {
      id: "state",
      name: "상태",
      width: "96px",
      cell: (r) =>
        r.off ? (
          <Tag>유형 미사용</Tag>
        ) : r.current && r.latest && !r.upToDate ? (
          <Tag variant="hot">최신 아님</Tag>
        ) : r.current ? (
          <Tag>최신</Tag>
        ) : (
          "-"
        ),
    },
    {
      id: "seed",
      name: <span className={styles.sr}>시드</span>,
      width: "136px",
      rowAction: true,
      cell: (r) =>
        r.latest ? (
          <Button size="sm" disabled={r.upToDate || r.off} onClick={() => r.latest && onSeed(r.type, r.latest)}>
            최신 배포본 시드
          </Button>
        ) : null,
    },
  ];
  return (
    <Panel>
      <PanelHeader title="유형별 교정 규칙 시드">
        <Tag>B-6.2 · E-8.1</Tag>
        <Button size="sm" variant="ghost" className={styles.headBtn} onClick={onRegister}>
          데이터셋 등록
        </Button>
      </PanelHeader>
      <DataTable label="유형별 교정 규칙 시드" columns={columns} data={rows} keyField="type" />
      <PanelBody className={styles.seedNote}>
        <p className={styles.mutedSmall}>
          시드는 고객사 × 유형 조합에 유효 데이터셋 하나를 연결하는 작업입니다. 기준 내용을 편집하거나 배포하는 기능은
          후속입니다.
        </p>
      </PanelBody>
    </Panel>
  );
}
