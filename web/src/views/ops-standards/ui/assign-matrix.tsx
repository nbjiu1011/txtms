"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/shared/lib";
import { Button, Panel, PanelBody, PanelHeader, Select, Table, Tag, tableClasses, toast } from "@/shared/ui";
import {
  ASSIGNABLE_TYPES,
  assignmentOf,
  datasetsOf,
  opsApi,
  type Dataset,
  type DatasetAssignment,
  type OpsCustomer,
} from "@/entities/ops";
import { CONTENT_TYPE_LABEL, type ContentType, type ContentTypeSetting } from "@/entities/request";
import { invalidateOps } from "@/features/ops-admin";
import styles from "./ops-standards.module.css";

export interface AssignMatrixProps {
  customers: OpsCustomer[];
  datasets: Dataset[];
  assignments: DatasetAssignment[];
  contentTypes: ContentTypeSetting[];
}

export const UNASSIGNED_TOAST = "배정을 해제했습니다. 다시 배정하기 전에는 이 조합의 텍스트 교정을 실행할 수 없습니다";


/**
 * 고객사 × 콘텐츠 유형 배정 (reference `vAssign`): one effective dataset per customer × type; picking a
 * version assigns (or changes, which resets the confirmation), 미배정 removes it, 확인 처리 confirms.
 */
export function AssignMatrix({ customers, datasets, assignments, contentTypes }: AssignMatrixProps) {
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  /** Select value being saved per cell (shown at once; the lists refresh afterwards). */
  const [pending, setPending] = useState<Record<string, string>>({});
  const run = async (key: string, work: () => Promise<string | null>, value?: string) => {
    setBusy(key);
    if (value !== undefined) setPending((p) => ({ ...p, [key]: value }));
    try {
      const message = await work();
      await invalidateOps(client);
      if (message) toast(message);
    } catch (error) {
      await invalidateOps(client);
      toast(error instanceof Error ? error.message : "배정을 바꾸지 못했습니다");
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      setBusy(null);
    }
  };

  const change = (customer: OpsCustomer, type: ContentType, value: string, current: DatasetAssignment | null) => {
    const key = `${customer.id}:${type}`;
    if (!value) {
      if (!current) return;
      void run(
        key,
        async () => {
          await opsApi.unassign(customer.id, type);
          return UNASSIGNED_TOAST;
        },
        "",
      );
      return;
    }
    const dataset = datasets.find((d) => d.id === Number(value));
    if (!dataset || current?.datasetId === dataset.id) return;
    void run(
      key,
      async () => {
        await opsApi.assign(customer.id, type, dataset.id);
        return `${CONTENT_TYPE_LABEL[type]} v${dataset.version}을 연결했습니다. 확인 처리까지 해 주세요`;
      },
      value,
    );
  };

  const confirm = (customer: OpsCustomer, type: ContentType) =>
    void run(`${customer.id}:${type}`, async () => {
      await opsApi.confirm(customer.id, type);
      return null;
    });

  return (
    <Panel className={styles.block}>
      <PanelHeader title="고객사 × 콘텐츠 유형 배정" note="조합마다 유효 데이터셋 하나만 연결합니다" />
      <Table className={styles.mx}>
        <thead>
          <tr>
            <th>고객사</th>
            {ASSIGNABLE_TYPES.map((t) => (
              <th key={t}>{CONTENT_TYPE_LABEL[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td className={tableClasses.ttl}>
                {c.name} {c.active ? null : <Tag variant="hot">비활성</Tag>}
                <div className={styles.rowSub}>
                  {c.unassignedDatasetTypes.length ? `미배정 ${c.unassignedDatasetTypes.length}개` : "배정 완료"}
                </div>
              </td>
              {ASSIGNABLE_TYPES.map((type) => {
                const current = assignmentOf(assignments, c.id, type);
                const off = contentTypes.find((t) => t.type === type)?.active === false;
                const key = `${c.id}:${type}`;
                const label = CONTENT_TYPE_LABEL[type];
                return (
                  <td key={type}>
                    <div className={styles.cell}>
                      <Select
                        aria-label={`${c.name} ${label} 데이터셋`}
                        className={styles.cellSel}
                        value={pending[key] ?? (current ? String(current.datasetId) : "")}
                        disabled={off || busy === key}
                        title={off ? "사용하지 않는 유형입니다" : undefined}
                        onChange={(e) => change(c, type, e.target.value, current)}
                      >
                        <option value="">미배정</option>
                        {datasetsOf(datasets, type).map((d) => (
                          <option key={d.id} value={d.id}>
                            {`v${d.version}  규칙 ${d.ruleCount}개`}
                          </option>
                        ))}
                      </Select>
                      {current ? (
                        current.checkedAt ? (
                          <span className={styles.ck}>
                            {formatDate(current.checkedAt)} 확인 {current.checkedByName ?? "운영 담당자"}
                          </span>
                        ) : (
                          <>
                            <span className={styles.ck}>
                              <span className={styles.unchecked}>확인 전</span>
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={styles.confirm}
                              disabled={busy === key}
                              aria-label={`${c.name} ${label} 확인 처리`}
                              onClick={() => confirm(c, type)}
                            >
                              확인 처리
                            </Button>
                          </>
                        )
                      ) : (
                        <span className={styles.ck}>연결된 기준이 없습니다</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

export interface EffectiveRulesPanelProps {
  customers: OpsCustomer[];
  customer: OpsCustomer;
  onPick: (id: number) => void;
  datasets: Dataset[];
  assignments: DatasetAssignment[];
  contentTypes: ContentTypeSetting[];
}

/**
 * `{고객사} 텍스트 교정에 실제 적용되는 기준` (reference EffectiveRulesPanel). Phase 1 checks with the
 * content type dataset only (공통 is Phase 2); an unassigned combination cannot run the check.
 */
export function EffectiveRulesPanel({
  customers,
  customer,
  onPick,
  datasets,
  assignments,
  contentTypes,
}: EffectiveRulesPanelProps) {
  return (
    <Panel>
      <PanelHeader title={`${customer.name} 텍스트 교정에 실제 적용되는 기준`}>
        <Select
          aria-label="기준을 볼 고객사"
          className={styles.headSel}
          value={customer.id}
          onChange={(e) => onPick(Number(e.target.value))}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </PanelHeader>
      <PanelBody>
        {ASSIGNABLE_TYPES.map((type) => {
          const a = assignmentOf(assignments, customer.id, type);
          const d = a ? datasets.find((x) => x.id === a.datasetId) : undefined;
          const off = contentTypes.find((t) => t.type === type)?.active === false;
          const label = CONTENT_TYPE_LABEL[type];
          return (
            <div key={type} className={styles.effRow}>
              <span className={styles.effType}>
                <b>{label}</b>
              </span>
              <span className={d ? styles.mutedSmall : styles.faintSmall}>
                {d ? `${label} v${d.version}  규칙 ${d.ruleCount}개` : `${label} 미배정`}
              </span>
              <span className={styles.sp} />
              {off ? <Tag>유형 미사용</Tag> : d ? <Tag>배정됨</Tag> : <Tag variant="hot">배정 전</Tag>}
            </div>
          );
        })}
        <p className={styles.faintSmall}>
          배정하지 않은 조합은 텍스트 교정을 실행할 수 없습니다. 고객사와 유형별 유효 데이터셋을 배정하세요. 배정 변경은
          이후 검사부터 적용됩니다.
        </p>
      </PanelBody>
    </Panel>
  );
}
