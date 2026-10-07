"use client";

import { useId } from "react";
import { downloadFile } from "@/shared/api";
import { Button, Field, Icon, Input, Label, Tag, Textarea, buttonClassName, toast } from "@/shared/ui";
import { FILE_UNIT_LABEL, requestFilePaths, type Content, type FileMeta, type FreeformPayload } from "@/entities/request";
import { parseFileRange, readFileRange, type FileRangeDraft } from "../model/file-range";
import { UPLOAD_STATE_LABEL, type UploadItem } from "../model/upload-queue";
import { bindText, type FieldsProps } from "./editor-binding";
import styles from "./work.module.css";

/** Policy note next to the attachment label. */
const ATTACHMENT_LIMIT_NOTE = "요청당 10개 · 파일당 20MB · 총 100MB";

/**
 * Attachment editing: amounts always; new files and deletion only in a draft (autosave); file
 * revisions (`수정본 업로드`, same extension) for assigned reviewers during review (revision buffer).
 */
export interface AttachmentEditing {
  range: (file: FileMeta) => FileRangeDraft;
  onRange: (file: FileMeta, next: FileRangeDraft) => void;
  onUpload?: (files: File[]) => void;
  onDelete?: (file: FileMeta) => void;
  uploads?: UploadItem[];
  busy: boolean;
  /** Review: uploads a new version of an attachment. */
  onUploadVersion?: (file: FileMeta, picked: File) => void;
  /** File id whose revision is uploading. */
  versionBusy?: number | null;
}

/** 자유입력형 fields: title, text and attachment rows with download, review range and upload. */
export function FreeformFields(
  props: FieldsProps<FreeformPayload> & { requestId: string; content: Content; attachments?: AttachmentEditing },
) {
  const { requestId, content, payload, disabled, onPayload, attachments } = props;
  const id = useId();
  const download = async (file: FileMeta) => {
    try {
      await downloadFile(requestFilePaths.fileVersion(requestId, content.key, file.id, file.version), file.name);
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : "파일을 내려받지 못했습니다");
    }
  };
  return (
    <>
      <Field label="제목 (선택)" htmlFor={`${id}-title`}>
        <Input id={`${id}-title`} value={payload.title} disabled={disabled} {...bindText(payload, "title", onPayload)} />
      </Field>
      <Field label="직접 입력 텍스트" htmlFor={`${id}-text`}>
        <Textarea id={`${id}-text`} rows={6} value={payload.text} disabled={disabled} {...bindText(payload, "text", onPayload)} />
      </Field>
      <Label className={styles.lbl}>
        첨부파일 <Tag>{ATTACHMENT_LIMIT_NOTE}</Tag>
      </Label>
      {content.files.map((file) => {
        const unit = FILE_UNIT_LABEL[file.unit];
        const range = attachments ? attachments.range(file) : readFileRange(file);
        const errors = attachments ? parseFileRange(range).errors : {};
        const set = (key: keyof FileRangeDraft) => ({
          readOnly: !attachments,
          onChange: (e: { target: { value: string } }) => attachments?.onRange(file, { ...range, [key]: e.target.value }),
        });
        return (
          <div key={file.id} className={styles.file}>
            <span className={styles.ext}>{file.ext}</span>
            <div>
              <b className={styles.fileName}>{file.name}</b>
              <div className={styles.faintSmall}>
                파일 v{file.version} 단위 {unit}
              </div>
            </div>
            <div className={styles.fileBtns}>
              {attachments?.onUploadVersion ? (
                <label
                  className={buttonClassName("default", "sm")}
                  aria-disabled={attachments.versionBusy === file.id || undefined}
                >
                  {attachments.versionBusy === file.id ? "업로드 중" : "수정본 업로드"}
                  <input
                    type="file"
                    hidden
                    aria-label={`${file.name} 수정본 업로드`}
                    disabled={attachments.versionBusy !== null && attachments.versionBusy !== undefined}
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      e.target.value = "";
                      if (picked) attachments.onUploadVersion?.(file, picked);
                    }}
                  />
                </label>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className={styles.btnIcon}
                aria-label={`${file.name} 다운로드`}
                title="다운로드"
                onClick={() => void download(file)}
              >
                <Icon name="down" />
              </Button>
              {attachments?.onDelete ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.btnIcon}
                  aria-label={`${file.name} 삭제`}
                  title="삭제"
                  disabled={attachments.busy}
                  onClick={() => attachments.onDelete?.(file)}
                >
                  <Icon name="x" />
                </Button>
              ) : null}
            </div>
            <div className={styles.fr}>
              <Field label={`전체 분량 (${unit})`} required error={errors.totalAmount}>
                <Input
                  type="number"
                  min={1}
                  value={range.totalAmount}
                  disabled={disabled}
                  aria-label={`${file.name} 전체 분량`}
                  aria-invalid={errors.totalAmount ? true : undefined}
                  {...set("totalAmount")}
                />
              </Field>
              <Field label={`실제 검수 범위 (${unit})`} required error={errors.reviewAmount}>
                <Input
                  type="number"
                  min={1}
                  value={range.reviewAmount}
                  disabled={disabled}
                  aria-label={`${file.name} 실제 검수 범위`}
                  aria-invalid={errors.reviewAmount ? true : undefined}
                  {...set("reviewAmount")}
                />
              </Field>
              <Field label="범위 설명" error={errors.rangeNote}>
                <Input
                  placeholder="예: 1~6쪽"
                  value={range.rangeNote}
                  disabled={disabled}
                  aria-label={`${file.name} 범위 설명`}
                  {...set("rangeNote")}
                />
              </Field>
            </div>
          </div>
        );
      })}
      {attachments?.onUpload ? (
        <>
          <label className={styles.drop} aria-disabled={attachments.busy || undefined}>
            파일을 선택해 올립니다. PDF, Word, 한글, Excel, PPT, 텍스트, 이미지
            <input
              type="file"
              multiple
              hidden
              aria-label="첨부파일 선택"
              disabled={attachments.busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) attachments.onUpload?.(files);
              }}
            />
          </label>
          <div role="status" aria-live="polite" className={styles.uploads}>
            {(attachments.uploads ?? []).map((u) => (
              <p key={u.id} data-state={u.state}>
                {u.name} · {UPLOAD_STATE_LABEL[u.state]}
                {u.error ? ` · ${u.error}` : ""}
              </p>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
