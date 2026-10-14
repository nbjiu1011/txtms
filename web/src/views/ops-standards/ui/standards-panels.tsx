"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelBody, PanelHeader, Tag, toast } from "@/shared/ui";
import { Button, Checkbox, DataTable, RowLink, type DataTableColumn } from "@/shared/common";
import { datasetScopeLabel, opsApi, type Dataset } from "@/entities/ops";
import { CONTENT_TYPE_LABEL, type ContentType, type ContentTypeSetting } from "@/entities/request";
import { invalidateOps } from "@/features/ops-admin";
import styles from "./ops-standards.module.css";

/** Fixed descriptions of the reference types table (H:1632). */
const TYPE_INPUTS: Record<ContentType, string> = {
  ALIMTALK: "승인 템플릿, 본문, 변수, 버튼",
  SMS: "발신번호(선택), 본문, 고객센터·수신거부 안내 여부",
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
  const columns: DataTableColumn<ContentTypeSetting>[] = [
    { id: "type", name: "유형", width: "110px", cell: (t) => <b>{CONTENT_TYPE_LABEL[t.type]}</b> },
    { id: "inputs", name: "주요 입력값", grow: 1, minWidth: "220px", wrap: true, cell: (t) => <span className={styles.small}>{TYPE_INPUTS[t.type]}</span> },
    { id: "support", name: "작성 지원", width: "230px", wrap: true, cell: (t) => <span className={styles.small}>{TYPE_SUPPORT[t.type]}</span> },
    {
      id: "mock",
      name: "목업 시드",
      width: "110px",
      cell: (t) =>
        t.type === "FREEFORM" ? (
          <span className={styles.faint}>해당 없음</span>
        ) : (
          <Checkbox label="표시" checked={t.mockEnabled} disabled readOnly title="목업 템플릿 관리는 후속입니다" />
        ),
    },
    {
      id: "active",
      name: (
        <span>
          사용 <Tag>1차 E-5.1</Tag>
        </span>
      ),
      width: "130px",
      rowAction: true,
      cell: (t) => (
        <Checkbox
          label="사용"
          aria-label={`${CONTENT_TYPE_LABEL[t.type]} 사용`}
          checked={pending[t.type] ?? t.active}
          disabled={busy === t.type}
          onChange={(e) => void toggle(t, e.target.checked)}
        />
      ),
    },
  ];
  return (
    <>
      <Panel>
        <DataTable label="유형 관리" columns={columns} data={types} keyField="type" />
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

const versionName = (d: Dataset) => `${datasetScopeLabel(d.scope)} v${d.version}`;

/** 교정 데이터셋 시드 (reference J:127): every registered version with its rule count; a row opens its rules. */
export function DatasetSeedPanel({ datasets, loading, onRegister, onOpen }: DatasetSeedPanelProps) {
  const columns: DataTableColumn<Dataset>[] = [
    {
      id: "scope",
      name: "유형",
      grow: 1,
      minWidth: "180px",
      rowAction: true,
      cell: (d) => (
        <span>
          <RowLink onClick={() => onOpen(d)} label={`${versionName(d)} 규칙 보기`}>
            {datasetScopeLabel(d.scope)}
          </RowLink>{" "}
          {d.scope === "COMMON" ? <Tag>후속</Tag> : null}
        </span>
      ),
    },
    { id: "version", name: "버전", width: "90px", cell: (d) => `v${d.version}` },
    { id: "rules", name: "규칙 수", width: "100px", cell: (d) => String(d.ruleCount) },
    { id: "created", name: "등록일", width: "170px", cell: (d) => formatDateTime(d.createdAt) },
  ];
  return (
    <Panel>
      <PanelHeader title="교정 데이터셋 시드" />
      <PanelBody>
        <p className={styles.lead}>
          문자열·정규표현식 규칙을 등록하고 고객사 × 콘텐츠 유형에 배정합니다. 버전을 누르면 규칙이 열립니다.
        </p>
        <Button variant="pri" onClick={onRegister}>
          데이터셋 등록
        </Button>
      </PanelBody>
      <DataTable
        label="교정 데이터셋"
        columns={columns}
        data={datasets}
        onRowClick={onOpen}
        loading={loading}
        empty={<Empty plain title="등록된 데이터셋이 없습니다" description="데이터셋 등록으로 첫 규칙 묶음을 올리세요." />}
      />
    </Panel>
  );
}
