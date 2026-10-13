"use client";

import { useId } from "react";
import { Icon } from "@/shared/ui";
import { Button, Checkbox, Field, Input, Label, Select, Textarea } from "@/shared/common";
import {
  MAX_ALIMTALK_BUTTONS_STORED,
  addAlimtalkButton,
  checkAlimtalk,
  checkSms,
  normalizePayload,
  removeAlimtalkButton,
  type AlimtalkPayload,
  type ChannelSpec,
  type Content,
  type ContentPayload,
  type ContentType,
  type FreeformPayload,
  type RcsPayload,
  type SmsPayload,
} from "@/entities/request";
import type { Project } from "@/entities/project";
import {
  AlimtalkBodyCounter,
  ChannelSpecNotice,
  SmsCounter,
  SpecNotes,
  alimtalkNotes,
  smsNotes,
} from "./channel-counters";
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
  /** Channel spec for the counters (`null` while loading: counts without limits). */
  channelSpec?: ChannelSpec | null;
  /** Current variable values for the expected length (unknown `#{key}` stay as typed). */
  values?: ReadonlyMap<string, string>;
}

interface SpecProps {
  spec: ChannelSpec | null;
  values?: ReadonlyMap<string, string>;
}

/**
 * Type-specific content fields (reference `editorFields`). Text controls carry `data-path` (the
 * payload path) so the variable picker can insert at the caret of the last focused field.
 */
export function ContentEditor(props: ContentEditorProps) {
  const { requestId, type, content, project, disabled, onPayload, attachments, images, values } = props;
  const payload = normalizePayload(type, content.payload);
  const edit = disabled ? undefined : onPayload;
  const spec = props.channelSpec ?? null;
  switch (type) {
    case "ALIMTALK":
      return (
        <AlimtalkFields
          payload={payload as AlimtalkPayload}
          project={project}
          disabled={disabled}
          onPayload={edit}
          spec={spec}
          values={values}
        />
      );
    case "SMS":
      return (
        <SmsFields
          payload={payload as SmsPayload}
          disabled={disabled}
          onPayload={edit}
          spec={spec}
          values={values}
        />
      );
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

type AlimtalkFieldsProps = FieldsProps<AlimtalkPayload> & SpecProps & { project: Project | null };

function AlimtalkFields({ payload, project, disabled, onPayload, spec, values }: AlimtalkFieldsProps) {
  const id = useId();
  const templates = project?.templates ?? [];
  const known = templates.some((t) => t.code === payload.templateCode);
  const check = checkAlimtalk(payload, spec?.alimtalk ?? null, values);
  const atCap = payload.buttons.length >= MAX_ALIMTALK_BUTTONS_STORED;
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
        <AlimtalkBodyCounter check={check} spec={spec?.alimtalk ?? null} />
      </Field>
      <Label className={styles.lbl}>버튼</Label>
      {payload.buttons.map((b, i) => (
        <div key={i} className={styles.btnrow}>
          <Input
            placeholder="버튼명"
            aria-label={`버튼 ${i + 1} 이름`}
            className={check.longNames[i] ? styles.inputWarn : undefined}
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
        <div className={styles.chkRow}>
          <Button size="sm" disabled={atCap} onClick={() => onPayload(addAlimtalkButton(payload))}>
            <Icon name="plus" />
            버튼 추가
          </Button>
          {atCap ? (
            <span className={styles.faintSmall}>버튼은 최대 {MAX_ALIMTALK_BUTTONS_STORED}개까지 저장할 수 있습니다</span>
          ) : null}
        </div>
      ) : payload.buttons.length === 0 ? (
        <span className={styles.faintSmall}>버튼 없음</span>
      ) : null}
      {spec ? <SpecNotes notes={alimtalkNotes(check, spec.alimtalk, payload.buttons)} /> : null}
      <ChannelSpecNotice />
    </>
  );
}

type SmsFieldsProps = FieldsProps<SmsPayload> & SpecProps;

function SmsFields({ payload, disabled, onPayload, spec, values }: SmsFieldsProps) {
  const id = useId();
  const check = checkSms(payload, spec?.sms ?? null, values);
  return (
    <>
      {/* optional free text: the service never sends, so there is no registered-number list */}
      <Field label="발신번호" htmlFor={`${id}-sender`}>
        <Input
          id={`${id}-sender`}
          placeholder="예: 1588-0000"
          inputMode="tel"
          value={payload.sender}
          disabled={disabled}
          readOnly={!onPayload}
          onChange={(e) => onPayload?.({ ...payload, sender: e.target.value })}
        />
      </Field>
      <Field label="본문" required htmlFor={`${id}-body`}>
        <Textarea id={`${id}-body`} rows={8} value={payload.body} disabled={disabled} {...bindText(payload, "body", onPayload)} />
        <SmsCounter check={check} />
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
      {spec ? <SpecNotes notes={smsNotes(check, spec.sms)} /> : null}
      <ChannelSpecNotice />
    </>
  );
}
