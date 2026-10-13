"use client";

import Link from "next/link";
import { useId } from "react";
import { formatDate } from "@/shared/lib";
import { KeyValueList, Panel, PanelBody, PanelHeader, SaveIndicator } from "@/shared/ui";
import { Button, Field, Input, Select, Textarea } from "@/shared/common";
import {
  CONTENT_TYPE_LABEL,
  RequestStatusChip,
  URGENCY_LABEL,
  type ContentType,
} from "@/entities/request";
import type { InfoKey } from "../model/draft-session";
import { saveLabel } from "../model/save-label";
import type { DraftEditing } from "../model/use-draft-editing";
import type { RequestPage } from "../model/use-request-page";
import styles from "./tabs.module.css";

export interface InfoTabProps {
  page: RequestPage;
  /** Active content types (the select lists them; an inactive current type is appended). */
  activeTypes: ContentType[];
  onOpenRequest: (id: string) => void;
  /** Draft editing (autosave); null renders the read-only form. */
  editing: DraftEditing | null;
  /** Type select changed (the caller confirms when contents would be reset). */
  onTypeChange: (type: ContentType) => void;
  /** 납기·긴급도 변경 (shown when the user may change the schedule). */
  onEditDue?: () => void;
}

/** 요청 정보 sub tab: editable by the draft's author (autosave), read-only otherwise. */
export function InfoTab({ page, activeTypes, onOpenRequest, editing, onTypeChange, onEditDue }: InfoTabProps) {
  const { request: r, project, users } = page;
  const types = activeTypes.length ? activeTypes : [r.type];
  const ed = editing?.canEditRequest ? editing : null;
  const id = useId();
  const field = (key: InfoKey) => {
    const error = ed?.infoErrors[key];
    return {
      id: `${id}-${key}`,
      value: ed ? ed.session.infoValue(key, r) : ((r[key] as string | null) ?? ""),
      disabled: !ed,
      readOnly: !ed,
      "aria-invalid": error ? true : undefined,
      onChange: (e: { target: { value: string } }) => {
        if (!ed) return;
        ed.session.setInfo(key, e.target.value);
        if (e.target.value.trim()) ed.clearInfoError(key);
      },
    };
  };
  const err = (key: string) => ed?.infoErrors[key];
  const state = ed?.session.saveState;
  return (
    <div className={styles.infoGrid}>
      <Panel>
        <PanelHeader title="요청 정보">
          {state ? (
            <span className={styles.saveRight}>
              <SaveIndicator state={state.status}>{saveLabel(state)}</SaveIndicator>
            </span>
          ) : null}
        </PanelHeader>
        <PanelBody>
          <Field label="제목" required htmlFor={`${id}-title`} error={err("title")}>
            <Input {...field("title")} />
          </Field>
          <div className={styles.grid2}>
            <Field label="유형" required htmlFor={`${id}-type`} error={err("type")}>
              <Select
                id={`${id}-type`}
                value={r.type}
                disabled={!ed}
                aria-invalid={err("type") ? true : undefined}
                onChange={(e) => onTypeChange(e.target.value as ContentType)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {CONTENT_TYPE_LABEL[t]}
                  </option>
                ))}
                {types.includes(r.type) ? null : <option value={r.type}>{CONTENT_TYPE_LABEL[r.type]} (비활성)</option>}
              </Select>
            </Field>
            <Field label="희망 납기" required htmlFor={`${id}-hopeDueDate`} error={err("hopeDueDate")}>
              <Input type="date" {...field("hopeDueDate")} />
            </Field>
          </div>
          <Field label="목적" required htmlFor={`${id}-purpose`} error={err("purpose")}>
            <Input {...field("purpose")} />
          </Field>
          <Field label="대상 고객" required htmlFor={`${id}-target`} error={err("target")}>
            <Input {...field("target")} />
          </Field>
          <Field label="배경" required htmlFor={`${id}-background`} error={err("background")}>
            <Textarea rows={3} className={styles.bgArea} {...field("background")} />
          </Field>
          <Field label="캠페인" htmlFor={`${id}-campaign`} error={err("campaign")}>
            <Input placeholder="선택" {...field("campaign")} />
          </Field>
        </PanelBody>
      </Panel>
      <div>
        <Panel>
          <PanelHeader title="관리 정보" />
          <PanelBody>
            <KeyValueList
              items={[
                { label: "요청 ID", value: r.id },
                { label: "프로젝트", value: project?.name ?? "-" },
                { label: "요청 상태", value: <RequestStatusChip status={r.status} /> },
                { label: "검수 차수", value: `${r.round}차` },
                {
                  label: "희망 납기",
                  value: (
                    <>
                      {formatDate(r.hopeDueDate)} <span className={styles.faintSmall}>요청자 입력값 보존</span>
                    </>
                  ),
                },
                { label: "확정 납기", value: formatDate(r.dueDate) },
                { label: "긴급도", value: URGENCY_LABEL[r.urgency] },
                { label: "대표 검수자", value: users.name(r.leadUserId ?? project?.leadUserId) },
                { label: "주담당 검수자", value: users.name(r.primaryReviewerId) },
                { label: "배정 검수자", value: r.reviewerIds.map((id) => users.name(id)).join(", ") || "-" },
                ...(r.parent
                  ? [
                      {
                        label: "원본 요청",
                        value: (
                          <Link
                            className={styles.link}
                            href={`/requests/${encodeURIComponent(r.parent.requestId)}`}
                            scroll={false}
                            onNavigate={(e) => {
                              e.preventDefault();
                              onOpenRequest(r.parent!.requestId);
                            }}
                          >
                            {r.parent.requestId}
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {onEditDue ? (
              <Button size="sm" className={styles.dueBtn} onClick={onEditDue}>
                납기·긴급도 변경
              </Button>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
