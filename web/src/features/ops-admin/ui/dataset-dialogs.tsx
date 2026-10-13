"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/shared/lib";
import { Empty, ErrorDetails, ReadOnlyBox, Table, toast } from "@/shared/ui";
import { Field, Modal, Seg, Select, Textarea, useServerError } from "@/shared/common";
import {
  ASSIGNABLE_TYPES,
  datasetScopeLabel,
  opsApi,
  useDatasetDetail,
  type Dataset,
  type DatasetAssignment,
} from "@/entities/ops";
import { CONTENT_TYPE_LABEL, type ContentType } from "@/entities/request";
import { DATASET_COLUMNS, RULES_JSON_PLACEHOLDER, parseRulesJson, xlsxFileProblem } from "../model/dataset-form";
import { invalidateOps } from "../model/invalidate";
import styles from "./ops.module.css";

type Source = "xlsx" | "json";

export interface DatasetRegisterDialogProps {
  open: boolean;
  onClose: () => void;
  /** Preselected type (e.g. the row of the seed table). */
  initialType?: ContentType;
}

/**
 * 교정 데이터셋 시드 등록 (reference J:128): a new immutable version of a type's dataset from the
 * 7-column XLSX or a pasted JSON array. Row refusals come back as `{행}행: …` details.
 */
export function DatasetRegisterDialog(props: DatasetRegisterDialogProps) {
  if (!props.open) return null;
  return <RegisterBody {...props} />;
}

function RegisterBody({ onClose, initialType }: DatasetRegisterDialogProps) {
  const id = useId();
  const client = useQueryClient();
  const [type, setType] = useState<ContentType>(initialType ?? "ALIMTALK");
  const [source, setSource] = useState<Source>("xlsx");
  const [file, setFile] = useState<File | null>(null);
  const [json, setJson] = useState("");
  const server = useServerError("데이터셋을 등록하지 못했습니다");

  const submit = async () => {
    let created: Dataset;
    if (source === "xlsx") {
      const problem = xlsxFileProblem(file);
      if (problem) return server.reject(problem, "file");
      server.clear();
      try {
        created = await opsApi.uploadDataset(type, file as File);
      } catch (error) {
        return server.fail(error);
      }
    } else {
      const parsed = parseRulesJson(json);
      if ("error" in parsed) return server.reject(parsed.error, "rules");
      server.clear();
      try {
        created = await opsApi.createDataset({ scope: type, rules: parsed.rules });
      } catch (error) {
        return server.fail(error);
      }
    }
    await invalidateOps(client);
    toast(`${datasetScopeLabel(created.scope)} v${created.version} 데이터셋을 등록했습니다 (규칙 ${created.ruleCount}개)`);
    return undefined;
  };

  return (
    <Modal open onClose={onClose} title="교정 데이터셋 시드 등록" okLabel="등록" onOk={submit}>
      <Field label="유형" htmlFor={`${id}-type`} error={server.field("scope")}>
        <Select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as ContentType)}>
          {ASSIGNABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Seg
        className={styles.segRow}
        label="등록 방식"
        options={[
          { key: "xlsx", label: "XLSX 파일" },
          { key: "json", label: "JSON 붙여넣기" },
        ]}
        value={source}
        onChange={(next) => {
          server.clear();
          setSource(next);
        }}
      />
      {source === "xlsx" ? (
        <Field
          label="규칙 파일"
          required
          htmlFor={`${id}-file`}
          hint={`7열 양식: ${DATASET_COLUMNS.join(", ")} · 첫 시트 1행 머리글 · 최대 10MB`}
          error={server.field("file")}
        >
          <input
            id={`${id}-file`}
            type="file"
            className={styles.file}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      ) : (
        <Field
          label="규칙 JSON 배열"
          required
          htmlFor={`${id}-json`}
          hint="키: ruleId, originalExpr, recommendedExpr, originalPattern, recommendedPattern, descriptionLabel, description"
          error={server.field("rules")}
        >
          <Textarea
            id={`${id}-json`}
            className={styles.code}
            placeholder={RULES_JSON_PLACEHOLDER}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
        </Field>
      )}
      <p className={styles.smallMuted}>
        등록한 버전은 바뀌지 않습니다. 고객사 × 유형 배정은 따로 하며, 배정 변경은 이후 검사부터 적용됩니다.
      </p>
      <ErrorDetails
        className={styles.detailsScroll}
        message={server.inline.message}
        items={server.inline.items}
      />
    </Modal>
  );
}

export interface DatasetRulesDialogProps {
  dataset: Dataset | null;
  onClose: () => void;
}

/** Rules of one dataset version (read only, row order). */
export function DatasetRulesDialog({ dataset, onClose }: DatasetRulesDialogProps) {
  const detail = useDatasetDetail(dataset?.id ?? null);
  if (!dataset) return null;
  const rules = detail.data?.rules ?? [];
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`${datasetScopeLabel(dataset.scope)} v${dataset.version} 규칙`}
      description={`규칙 ${dataset.ruleCount}개 · ${formatDateTime(dataset.createdAt)} 등록`}
      cancelLabel="닫기"
    >
      {detail.isPending ? (
        <Empty plain title="규칙을 불러오는 중입니다" />
      ) : detail.isError ? (
        <Empty title="규칙을 불러오지 못했습니다" description={detail.error.message} />
      ) : (
        <Table wrapClassName={styles.rulesWrap}>
          <thead>
            <tr>
              <th>rule_id</th>
              <th>기존 표현·패턴</th>
              <th>권장 표현·패턴</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.ruleId}>
                <td className={styles.mono}>{r.ruleId}</td>
                <td className={styles.mono}>{r.originalExpr || r.originalPattern}</td>
                <td className={styles.mono}>{r.originalExpr ? r.recommendedExpr : r.recommendedPattern}</td>
                <td className={styles.desc}>
                  {r.descriptionLabel ? <b>{r.descriptionLabel}</b> : null} {r.description}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}

export interface SeedRuleDialogProps {
  open: boolean;
  onClose: () => void;
  customer: { id: number; name: string };
  type: ContentType;
  /** Newest dataset of the type (what the seed connects). */
  latest: Dataset;
  current: { assignment: DatasetAssignment; dataset: Dataset | null } | null;
}

/**
 * `{유형} 교정 규칙 시드` (reference `seedRule`): connects the newest version to the customer × type and
 * confirms it in one go.
 */
export function SeedRuleDialog(props: SeedRuleDialogProps) {
  if (!props.open) return null;
  return <SeedRuleBody {...props} />;
}

function SeedRuleBody({ onClose, customer, type, latest, current }: SeedRuleDialogProps) {
  const client = useQueryClient();
  const detail = useDatasetDetail(latest.id);
  const server = useServerError("유효 데이터셋을 연결하지 못했습니다");
  const label = CONTENT_TYPE_LABEL[type];
  const rules = detail.data?.rules ?? [];

  const submit = async () => {
    server.clear();
    try {
      await opsApi.assign(customer.id, type, latest.id);
      await opsApi.confirm(customer.id, type);
    } catch (error) {
      await invalidateOps(client);
      return server.fail(error);
    }
    await invalidateOps(client);
    toast("유효 데이터셋을 연결했습니다");
    return undefined;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${label} 교정 규칙 시드`}
      description={`${customer.name} × ${label} 조합에 ${label} v${latest.version}을 유효 데이터셋으로 연결합니다.`}
      okLabel="시드 적용"
      onOk={submit}
    >
      <ReadOnlyBox className={styles.roBox}>
        <b>규칙 {latest.ruleCount}개</b>
        {rules.slice(0, 6).map((r) => (
          <div key={r.ruleId}>
            {r.originalExpr || r.originalPattern} &gt; {r.originalExpr ? r.recommendedExpr : r.recommendedPattern}{"  "}
            <span className={styles.muted}>{r.descriptionLabel}</span>
          </div>
        ))}
        {latest.ruleCount > 6 ? <div className={styles.muted}>외 {latest.ruleCount - 6}개</div> : null}
      </ReadOnlyBox>
      <p className={styles.smallMuted}>
        {current?.dataset ? `현재 연결: v${current.dataset.version}` : "현재 연결된 기준이 없습니다."} 이미 실행한 교정
        결과는 바뀌지 않고, 이후 실행부터 적용됩니다.
      </p>
      <ErrorDetails message={server.inline.message} items={server.inline.items} />
    </Modal>
  );
}
