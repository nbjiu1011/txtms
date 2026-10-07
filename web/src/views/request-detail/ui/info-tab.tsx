import Link from "next/link";
import { formatDate } from "@/shared/lib";
import { Field, Input, KeyValueList, Panel, PanelBody, PanelHeader, Select, Textarea } from "@/shared/ui";
import {
  CONTENT_TYPE_LABEL,
  RequestStatusChip,
  URGENCY_LABEL,
  type ContentType,
} from "@/entities/request";
import type { RequestPage } from "../model/use-request-page";
import styles from "./tabs.module.css";

export interface InfoTabProps {
  page: RequestPage;
  /** Active content types (the select lists them; an inactive current type is appended). */
  activeTypes: ContentType[];
  onOpenRequest: (id: string) => void;
}

const noop = () => undefined;

/** 요청 정보 sub tab — read-only in this build (editing arrives with M1). */
export function InfoTab({ page, activeTypes, onOpenRequest }: InfoTabProps) {
  const { request: r, project, users } = page;
  const types = activeTypes.length ? activeTypes : [r.type];
  return (
    <div className={styles.infoGrid}>
      <Panel>
        <PanelHeader title="요청 정보" />
        <PanelBody>
          <Field label="제목" required htmlFor="info-title">
            <Input id="info-title" value={r.title} disabled readOnly />
          </Field>
          <div className={styles.grid2}>
            <Field label="유형" required htmlFor="info-type">
              <Select id="info-type" value={r.type} disabled onChange={noop}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {CONTENT_TYPE_LABEL[t]}
                  </option>
                ))}
                {types.includes(r.type) ? null : <option value={r.type}>{CONTENT_TYPE_LABEL[r.type]} (비활성)</option>}
              </Select>
            </Field>
            <Field label="희망 납기" required htmlFor="info-hope">
              <Input id="info-hope" type="date" value={r.hopeDueDate ?? ""} disabled readOnly />
            </Field>
          </div>
          <Field label="목적" required htmlFor="info-purpose">
            <Input id="info-purpose" value={r.purpose ?? ""} disabled readOnly />
          </Field>
          <Field label="대상 고객" required htmlFor="info-target">
            <Input id="info-target" value={r.target ?? ""} disabled readOnly />
          </Field>
          <Field label="배경" required htmlFor="info-bg">
            <Textarea id="info-bg" rows={3} className={styles.bgArea} value={r.background ?? ""} disabled readOnly />
          </Field>
          <Field label="캠페인" htmlFor="info-campaign">
            <Input id="info-campaign" placeholder="선택" value={r.campaign ?? ""} disabled readOnly />
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
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
