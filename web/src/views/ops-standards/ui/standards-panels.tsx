"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/shared/lib";
import { Button, Checkbox, Empty, Panel, PanelBody, PanelHeader, Table, Tag, tableClasses, toast } from "@/shared/ui";
import { datasetScopeLabel, opsApi, type Dataset } from "@/entities/ops";
import { CONTENT_TYPE_LABEL, type ContentType, type ContentTypeSetting } from "@/entities/request";
import { invalidateOps } from "@/features/ops-admin";
import styles from "./ops-standards.module.css";

/** Fixed descriptions of the reference types table (H:1632). */
const TYPE_INPUTS: Record<ContentType, string> = {
  ALIMTALK: "승인 템플릿, 본문, 변수, 버튼",
  SMS: "발신번호, 본문, 고객센터·수신거부 안내 여부",
  RCS: "제목, 본문, 이미지, 이미지 설명, 카드 수, 버튼",
  FREEFORM: "직접 입력 텍스트, 변수, 선택 제목, 첨부파일",
};
const TYPE_SUPPORT: Record<ContentType, string> = {
  ALIMTALK: "텍스트 교정, 목업, XLSX 대량 등록",
  SMS: "텍스트 교정, 목업, XLSX 대량 등록",
  RCS: "텍스트 교정, 목업",
  FREEFORM: "텍스트 교정 또는 파일 버전·다운로드",
};

/**
 * 유형 관리 (reference ContentTypeTable): 사용 toggles the type at once (new requests can no longer pick a
 * stopped type). 목업 시드 is shown read-only — managing mock templates is Phase 2.
 */
export function ContentTypeTable({ types }: { types: ContentTypeSetting[] }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState<ContentType | null>(null);
  /** The value being saved (shown at once; the list is refreshed afterwards). */
  const [pending, setPending] = useState<Partial<Record<ContentType, boolean>>>({});
  const toggle = async (t: ContentTypeSetting, active: boolean) => {
    setBusy(t.type);
    setPending((p) => ({ ...p, [t.type]: active }));
    try {
      await opsApi.setContentTypeActive(t.type, active);
    } catch (error) {
      toast(error instanceof Error ? error.message : "유형 사용 상태를 바꾸지 못했습니다");
    } finally {
      await invalidateOps(client);
      setPending((p) => {
        const next = { ...p };
        delete next[t.type];
        return next;
      });
      setBusy(null);
    }
  };
  return (
    <>
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>유형</th>
              <th>주요 입력값</th>
              <th>작성 지원</th>
              <th>목업 시드</th>
              <th>
                사용 <Tag>1차 E-5.1</Tag>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type}>
                <td className={tableClasses.ttl}>{CONTENT_TYPE_LABEL[t.type]}</td>
                <td className={styles.small}>{TYPE_INPUTS[t.type]}</td>
                <td className={styles.small}>{TYPE_SUPPORT[t.type]}</td>
                <td>
                  {t.type === "FREEFORM" ? (
                    <span className={styles.faint}>해당 없음</span>
                  ) : (
                    <Checkbox label="표시" checked={t.mockEnabled} disabled readOnly title="목업 템플릿 관리는 후속입니다" />
                  )}
                </td>
                <td>
                  <Checkbox
                    label="사용"
                    aria-label={`${CONTENT_TYPE_LABEL[t.type]} 사용`}
                    checked={pending[t.type] ?? t.active}
                    disabled={busy === t.type}
                    onChange={(e) => void toggle(t, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <p className={styles.faintNote}>
        사용을 끈 유형은 새 요청에서 고를 수 없습니다. 과거 요청을 새 유형으로 자동 변환하지 않습니다. 1차는 유형별 사용
        상태 관리까지이며, 목업 템플릿 등록·관리는 후속입니다.
      </p>
    </>
  );
}

export interface DatasetSeedPanelProps {
  datasets: Dataset[];
  loading: boolean;
  onRegister: () => void;
  onOpen: (dataset: Dataset) => void;
}

/** 교정 데이터셋 시드 (reference J:127): every registered version with its rule count. */
export function DatasetSeedPanel({ datasets, loading, onRegister, onOpen }: DatasetSeedPanelProps) {
  return (
    <Panel>
      <PanelHeader title="교정 데이터셋 시드" />
      <PanelBody>
        <p className={styles.lead}>문자열·정규표현식 규칙을 등록하고 고객사 × 콘텐츠 유형에 배정합니다.</p>
        <Button variant="pri" onClick={onRegister}>
          데이터셋 등록
        </Button>
      </PanelBody>
      {datasets.length === 0 ? (
        <Empty plain title={loading ? "데이터셋을 불러오는 중입니다" : "등록된 데이터셋이 없습니다"} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>유형</th>
              <th>버전</th>
              <th>규칙 수</th>
              <th>등록일</th>
              <th>
                <span className={styles.sr}>규칙</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id}>
                <td>
                  {datasetScopeLabel(d.scope)} {d.scope === "COMMON" ? <Tag>후속</Tag> : null}
                </td>
                <td>v{d.version}</td>
                <td className={styles.num}>{d.ruleCount}</td>
                <td>{formatDateTime(d.createdAt)}</td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${datasetScopeLabel(d.scope)} v${d.version} 규칙 보기`}
                    onClick={() => onOpen(d)}
                  >
                    규칙 보기
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
