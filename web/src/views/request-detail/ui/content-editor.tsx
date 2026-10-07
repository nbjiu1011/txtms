"use client";

import { useId } from "react";
import { Button, Checkbox, Field, Icon, Input, Label, Select, Tag, Textarea } from "@/shared/ui";
import {
  MAX_ALIMTALK_BUTTONS,
  addAlimtalkButton,
  isShortSms,
  normalizePayload,
  removeAlimtalkButton,
  smsBytes,
  type AlimtalkPayload,
  type Content,
  type ContentPayload,
  type ContentType,
  type FreeformPayload,
  type RcsPayload,
  type SmsPayload,
} from "@/entities/request";
import type { Project } from "@/entities/project";
import { bindText, type FieldsProps } from "./editor-binding";
import { FreeformFields, type AttachmentEditing } from "./freeform-fields";
import { RcsFields, type CardImageEditing } from "./rcs-fields";
import styles from "./work.module.css";

export interface ContentEditorProps {
  requestId: string;
  type: ContentType;
  /** Content as shown (local edits applied). */
  content: Content;
  project: Project | null;
  /** Every control is disabled (reference `dis`). */
  disabled: boolean;
  /** Draft editing: called with the next payload on every change. Absent = read-only. */
  onPayload?: (payload: ContentPayload) => void;
  /** 자유입력형 attachments while editing a draft. */
  attachments?: AttachmentEditing;
  /** RCS card images while editing a draft. */
  images?: CardImageEditing;
}

/** Policy note next to the 알림톡 body counter. */
const ALIMTALK_LIMIT_NOTE = "본문 최대 1,000자 · 버튼 5개 · 버튼명 14자";

/**
 * Type-specific content fields (reference `editorFields`). Text controls carry `data-path` (the
 * payload path) so the variable picker can insert at the caret of the last focused field.
 */
export function ContentEditor(props: ContentEditorProps) {
  const { requestId, type, content, project, disabled, onPayload, attachments, images } = props;
  const payload = normalizePayload(type, content.payload);
  const edit = disabled ? undefined : onPayload;
  switch (type) {
    case "ALIMTALK":
      return <AlimtalkFields payload={payload as AlimtalkPayload} project={project} disabled={disabled} onPayload={edit} />;
    case "SMS":
      return <SmsFields payload={payload as SmsPayload} project={project} disabled={disabled} onPayload={edit} />;
    case "RCS":
      return (
        <RcsFields
          payload={payload as RcsPayload}
          disabled={disabled}
          onPayload={edit}
          images={disabled ? undefined : images}
        />
      );
    case "FREEFORM":
      return (
        <FreeformFields
          requestId={requestId}
          content={content}
          payload={payload as FreeformPayload}
          disabled={disabled}
          onPayload={edit}
          attachments={disabled ? undefined : attachments}
        />
      );
  }
}

function AlimtalkFields({ payload, project, disabled, onPayload }: FieldsProps<AlimtalkPayload> & { project: Project | null }) {
  const id = useId();
  const templates = project?.templates ?? [];
  const known = templates.some((t) => t.code === payload.templateCode);
  return (
    <>
      <Field label="승인 템플릿" required htmlFor={`${id}-tpl`}>
        <Select
          id={`${id}-tpl`}
          value={payload.templateCode}
          disabled={disabled}
          onChange={(e) => onPayload?.({ ...payload, templateCode: e.target.value })}
        >
          <option value="">템플릿 선택</option>
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name} ({t.code})
            </option>
          ))}
          {!known && payload.templateCode ? <option value={payload.templateCode}>{payload.templateCode}</option> : null}
        </Select>
      </Field>
      <Field label="본문" required htmlFor={`${id}-body`}>
        <Textarea id={`${id}-body`} rows={8} value={payload.body} disabled={disabled} {...bindText(payload, "body", onPayload)} />
        <div className={styles.counter} aria-live="polite">
          {payload.body.length}자 <Tag>{ALIMTALK_LIMIT_NOTE}</Tag>
        </div>
      </Field>
      <Label className={styles.lbl}>버튼</Label>
      {payload.buttons.map((b, i) => (
        <div key={i} className={styles.btnrow}>
          <Input
            placeholder="버튼명"
            aria-label={`버튼 ${i + 1} 이름`}
            value={b.name}
            disabled={disabled}
            {...bindText(payload, `buttons.${i}.name`, onPayload)}
          />
          <Input
            placeholder="https://"
            aria-label={`버튼 ${i + 1} 링크`}
            value={b.link}
            disabled={disabled}
            {...bindText(payload, `buttons.${i}.link`, onPayload)}
          />
          <Button
            size="sm"
            variant="ghost"
            className={styles.btnIcon}
            disabled={disabled || !onPayload}
            aria-label={`버튼 ${i + 1} 삭제`}
            onClick={() => onPayload?.(removeAlimtalkButton(payload, i))}
          >
            <Icon name="x" />
          </Button>
        </div>
      ))}
      {!disabled && onPayload ? (
        <Button
          size="sm"
          disabled={payload.buttons.length >= MAX_ALIMTALK_BUTTONS}
          onClick={() => onPayload(addAlimtalkButton(payload))}
        >
          <Icon name="plus" />
          버튼 추가
        </Button>
      ) : payload.buttons.length === 0 ? (
        <span className={styles.faintSmall}>버튼 없음</span>
      ) : null}
    </>
  );
}

function SmsFields({ payload, project, disabled, onPayload }: FieldsProps<SmsPayload> & { project: Project | null }) {
  const id = useId();
  const senders = project?.senders ?? [];
  const bytes = smsBytes(payload);
  return (
    <>
      <Field label="발신번호" required htmlFor={`${id}-sender`}>
        <Select
          id={`${id}-sender`}
          value={payload.sender}
          disabled={disabled}
          onChange={(e) => onPayload?.({ ...payload, sender: e.target.value })}
        >
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
      <Field label="본문" required htmlFor={`${id}-body`}>
        <Textarea id={`${id}-body`} rows={8} value={payload.body} disabled={disabled} {...bindText(payload, "body", onPayload)} />
        <div className={styles.counter} aria-live="polite">
          {bytes}바이트 {isShortSms(bytes) ? "단문" : "장문"} (안내 문구 포함)
        </div>
      </Field>
      <div className={styles.chkRow}>
        <Checkbox
          label="고객센터 안내 포함"
          checked={payload.customerCenter}
          disabled={disabled}
          readOnly={!onPayload}
          onChange={(e) => onPayload?.({ ...payload, customerCenter: e.target.checked })}
        />
        <Checkbox
          label="수신거부 안내 포함"
          checked={payload.optOut}
          disabled={disabled}
          readOnly={!onPayload}
          onChange={(e) => onPayload?.({ ...payload, optOut: e.target.checked })}
        />
      </div>
    </>
  );
}
