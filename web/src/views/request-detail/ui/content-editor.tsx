"use client";

import { Button, Checkbox, Field, Icon, Input, Label, Select, Tag, Textarea } from "@/shared/ui";
import {
  isShortSms,
  normalizePayload,
  smsBytes,
  type AlimtalkPayload,
  type Content,
  type ContentType,
  type FreeformPayload,
  type RcsPayload,
  type SmsPayload,
} from "@/entities/request";
import type { Project } from "@/entities/project";
import { FreeformFields } from "./freeform-fields";
import styles from "./work.module.css";

export interface ContentEditorProps {
  requestId: string;
  type: ContentType;
  content: Content;
  project: Project | null;
  /** Every control is disabled (reference `dis`). Editing flows arrive with M1/M2. */
  disabled: boolean;
}

/** Policy note next to the 알림톡 body counter. */
const ALIMTALK_LIMIT_NOTE = "본문 최대 1,000자 · 버튼 5개 · 버튼명 14자";
const noop = () => undefined;

/** Type-specific content fields (reference `editorFields`), read-only in this build. */
export function ContentEditor({ requestId, type, content, project, disabled }: ContentEditorProps) {
  const payload = normalizePayload(type, content.payload);
  switch (type) {
    case "ALIMTALK":
      return <AlimtalkFields payload={payload as AlimtalkPayload} project={project} disabled={disabled} />;
    case "SMS":
      return <SmsFields payload={payload as SmsPayload} project={project} disabled={disabled} />;
    case "RCS":
      return <RcsFields payload={payload as RcsPayload} disabled={disabled} />;
    case "FREEFORM":
      return (
        <FreeformFields requestId={requestId} content={content} payload={payload as FreeformPayload} disabled={disabled} />
      );
  }
}

export interface FieldsProps<P> {
  payload: P;
  disabled: boolean;
}

function AlimtalkFields({ payload, project, disabled }: FieldsProps<AlimtalkPayload> & { project: Project | null }) {
  const templates = project?.templates ?? [];
  const known = templates.some((t) => t.code === payload.templateCode);
  return (
    <>
      <Field label="승인 템플릿" required htmlFor="ed-tpl">
        <Select id="ed-tpl" value={payload.templateCode} disabled={disabled} onChange={noop}>
          <option value="">템플릿 선택</option>
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name} ({t.code})
            </option>
          ))}
          {!known && payload.templateCode ? <option value={payload.templateCode}>{payload.templateCode}</option> : null}
        </Select>
      </Field>
      <Field label="본문" required htmlFor="ed-body">
        <Textarea id="ed-body" rows={8} value={payload.body} disabled={disabled} readOnly />
        <div className={styles.counter}>
          {payload.body.length}자 <Tag>{ALIMTALK_LIMIT_NOTE}</Tag>
        </div>
      </Field>
      <Label className={styles.lbl}>버튼</Label>
      {payload.buttons.map((b, i) => (
        <div key={i} className={styles.btnrow}>
          <Input placeholder="버튼명" aria-label={`버튼 ${i + 1} 이름`} value={b.name} disabled={disabled} readOnly />
          <Input placeholder="https://" aria-label={`버튼 ${i + 1} 링크`} value={b.link} disabled={disabled} readOnly />
          <Button size="sm" variant="ghost" className={styles.btnIcon} disabled aria-label="버튼 삭제">
            <Icon name="x" />
          </Button>
        </div>
      ))}
      {payload.buttons.length === 0 ? <span className={styles.faintSmall}>버튼 없음</span> : null}
    </>
  );
}

function SmsFields({ payload, project, disabled }: FieldsProps<SmsPayload> & { project: Project | null }) {
  const senders = project?.senders ?? [];
  const bytes = smsBytes(payload);
  return (
    <>
      <Field label="발신번호" required htmlFor="ed-sender">
        <Select id="ed-sender" value={payload.sender} disabled={disabled} onChange={noop}>
          <option value="">등록된 발신번호 선택</option>
          {senders.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {payload.sender && !senders.includes(payload.sender) ? (
            <option value={payload.sender}>{payload.sender}</option>
          ) : null}
        </Select>
      </Field>
      <Field label="본문" required htmlFor="ed-body">
        <Textarea id="ed-body" rows={8} value={payload.body} disabled={disabled} readOnly />
        <div className={styles.counter}>
          {bytes}바이트 {isShortSms(bytes) ? "단문" : "장문"} (안내 문구 포함)
        </div>
      </Field>
      <div className={styles.chkRow}>
        <Checkbox label="고객센터 안내 포함" checked={payload.customerCenter} disabled={disabled} readOnly />
        <Checkbox label="수신거부 안내 포함" checked={payload.optOut} disabled={disabled} readOnly />
      </div>
    </>
  );
}

function RcsFields({ payload, disabled }: FieldsProps<RcsPayload>) {
  return (
    <>
      <Field label="카드 수" required htmlFor="ed-cards" className={styles.cardsField}>
        <Select id="ed-cards" value={String(payload.cards.length)} disabled={disabled} onChange={noop}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      {payload.cards.map((card, i) => (
        <div key={i} className={styles.cardEd}>
          <h4>카드 {i + 1}</h4>
          <Field label="제목" htmlFor={`ed-card-${i}-title`}>
            <Input id={`ed-card-${i}-title`} value={card.title} disabled={disabled} readOnly />
          </Field>
          <Field label="본문" required htmlFor={`ed-card-${i}-body`}>
            <Textarea
              id={`ed-card-${i}-body`}
              rows={3}
              className={styles.cardBody}
              value={card.body}
              disabled={disabled}
              readOnly
            />
          </Field>
          <div className={styles.grid2}>
            <Field label="이미지">
              <span className={styles.mutedSmall}>{card.imageKey ? "이미지 등록됨" : "이미지 없음"}</span>
            </Field>
            <Field label="이미지 설명" required={!!card.imageKey} htmlFor={`ed-card-${i}-alt`}>
              <Input
                id={`ed-card-${i}-alt`}
                placeholder="이미지 내용을 설명"
                value={card.imageAlt}
                disabled={disabled}
                readOnly
              />
            </Field>
          </div>
          <div className={styles.grid2}>
            <Field label="버튼명" htmlFor={`ed-card-${i}-bn`}>
              <Input id={`ed-card-${i}-bn`} value={card.buttonName} disabled={disabled} readOnly />
            </Field>
            <Field label="버튼 링크" htmlFor={`ed-card-${i}-bl`}>
              <Input id={`ed-card-${i}-bl`} value={card.buttonLink} disabled={disabled} readOnly />
            </Field>
          </div>
        </div>
      ))}
    </>
  );
}
