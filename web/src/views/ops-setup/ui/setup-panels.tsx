"use client";

import { cn } from "@/shared/lib";
import { Button, Panel, PanelBody, PanelHeader, Table, Tag, tableClasses } from "@/shared/ui";
import {
  ASSIGNABLE_TYPES,
  assignmentOf,
  latestDataset,
  type Dataset,
  type DatasetAssignment,
  type OpsCustomer,
} from "@/entities/ops";
import type { Project } from "@/entities/project";
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

/**
 * 유형별 교정 규칙 시드 (reference `RuleSeedPanel`): the assigned dataset of each content type of the
 * customer next to the newest registered version, a one-click seed of the newest version.
 */
export function RuleSeedPanel({ customer, datasets, assignments, contentTypes, onSeed, onRegister }: RuleSeedPanelProps) {
  return (
    <Panel>
      <PanelHeader title="유형별 교정 규칙 시드">
        <Tag>B-6.2 · E-8.1</Tag>
        <Button size="sm" variant="ghost" className={styles.headBtn} onClick={onRegister}>
          데이터셋 등록
        </Button>
      </PanelHeader>
      <Table>
        <thead>
          <tr>
            <th>유형</th>
            <th>배정된 유효 데이터셋</th>
            <th>최신 배포본</th>
            <th>상태</th>
            <th>
              <span className={styles.sr}>시드</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ASSIGNABLE_TYPES.map((type) => {
            const assignment = assignmentOf(assignments, customer.id, type);
            const current = assignment ? (datasets.find((d) => d.id === assignment.datasetId) ?? null) : null;
            const latest = latestDataset(datasets, type);
            const off = contentTypes.find((t) => t.type === type)?.active === false;
            const upToDate = !!current && !!latest && current.id === latest.id;
            return (
              <tr key={type}>
                <td className={tableClasses.ttl}>{CONTENT_TYPE_LABEL[type]}</td>
                <td>
                  {current ? (
                    <>
                      v{current.version} <span className={styles.smallFaint}>규칙 {current.ruleCount}개</span>
                    </>
                  ) : (
                    <Tag variant="hot">미배정</Tag>
                  )}
                </td>
                <td>{latest ? `v${latest.version}` : <span className={styles.faint}>배포본 없음</span>}</td>
                <td>
                  {off ? (
                    <Tag>유형 미사용</Tag>
                  ) : current && latest && !upToDate ? (
                    <Tag variant="hot">최신 아님</Tag>
                  ) : current ? (
                    <Tag>최신</Tag>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {latest ? (
                    <Button size="sm" disabled={upToDate || off} onClick={() => onSeed(type, latest)}>
                      최신 배포본 시드
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <PanelBody className={styles.seedNote}>
        <p className={styles.mutedSmall}>
          시드는 고객사 × 유형 조합에 유효 데이터셋 하나를 연결하는 작업입니다. 기준 내용을 편집하거나 배포하는 기능은
          후속입니다.
        </p>
      </PanelBody>
    </Panel>
  );
}

export interface SendingPanelProps {
  projects: Project[];
  loading: boolean;
  /** Inactive customer: its projects are listed (operator API) but cannot be changed. */
  inactive: boolean;
  onEdit: (project: Project) => void;
}

/**
 * 프로젝트 발신 정보 (not in the reference): the 알림톡 templates and 문자 sender numbers each project's
 * contents are checked against on submission.
 */
export function SendingPanel({ projects, loading, inactive, onEdit }: SendingPanelProps) {
  return (
    <Panel className={styles.block}>
      <PanelHeader title="프로젝트 발신 정보" note="알림톡 템플릿과 문자 발신번호는 검수 요청 검증 기준입니다" />
      <Table>
        <thead>
          <tr>
            <th>프로젝트</th>
            <th>알림톡 템플릿</th>
            <th>문자 발신번호</th>
            <th>상태</th>
            <th>
              <span className={styles.sr}>편집</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.muted}>
                {loading
                  ? "불러오는 중입니다."
                  : inactive
                    ? "프로젝트가 없습니다."
                    : "프로젝트가 없습니다. 초기 프로젝트를 먼저 만드세요."}
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <tr key={p.id}>
                <td className={tableClasses.ttl}>{p.name}</td>
                <td>
                  {p.templates.length ? (
                    <>
                      {p.templates.slice(0, 3).map((t) => t.code).join(", ")}
                      {p.templates.length > 3 ? ` 외 ${p.templates.length - 3}개` : ""}
                    </>
                  ) : (
                    <span className={styles.faint}>없음</span>
                  )}
                </td>
                <td>
                  {p.senders.length ? (
                    <>
                      {p.senders.slice(0, 3).join(", ")}
                      {p.senders.length > 3 ? ` 외 ${p.senders.length - 3}개` : ""}
                    </>
                  ) : (
                    <span className={styles.faint}>없음</span>
                  )}
                </td>
                <td>{p.active ? <Tag>사용</Tag> : <Tag variant="hot">중지</Tag>}</td>
                <td>
                  <Button
                    size="sm"
                    disabled={inactive}
                    title={inactive ? "비활성 고객사입니다. 사용 재개 후 발신 정보를 설정하세요." : undefined}
                    onClick={() => onEdit(p)}
                  >
                    발신 정보
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Panel>
  );
}
