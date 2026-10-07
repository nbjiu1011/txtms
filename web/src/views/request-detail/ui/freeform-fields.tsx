"use client";

import { downloadFile } from "@/shared/api";
import { Button, Field, Icon, Input, Label, Tag, Textarea, toast } from "@/shared/ui";
import { FILE_UNIT_LABEL, requestFilePaths, type Content, type FileMeta, type FreeformPayload } from "@/entities/request";
import type { FieldsProps } from "./content-editor";
import styles from "./work.module.css";

/** Policy note next to the attachment label. */
const ATTACHMENT_LIMIT_NOTE = "요청당 10개 · 파일당 20MB · 총 100MB";

/** 자유입력형 fields: title, text and attachment rows with download and review range (read-only). */
export function FreeformFields(props: FieldsProps<FreeformPayload> & { requestId: string; content: Content }) {
  const { requestId, content, payload, disabled } = props;
  const download = async (file: FileMeta) => {
    try {
      await downloadFile(requestFilePaths.fileVersion(requestId, content.key, file.id, file.version), file.name);
    } catch (error) {
      toast(error instanceof Error && error.message ? error.message : "파일을 내려받지 못했습니다");
    }
  };
  return (
    <>
      <Field label="제목 (선택)" htmlFor="ed-ftitle">
        <Input id="ed-ftitle" value={payload.title} disabled={disabled} readOnly />
      </Field>
      <Field label="직접 입력 텍스트" htmlFor="ed-text">
        <Textarea id="ed-text" rows={6} value={payload.text} disabled={disabled} readOnly />
      </Field>
      <Label className={styles.lbl}>
        첨부파일 <Tag>{ATTACHMENT_LIMIT_NOTE}</Tag>
      </Label>
      {content.files.map((file) => {
        const unit = FILE_UNIT_LABEL[file.unit];
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
            </div>
            <div className={styles.fr}>
              <Field label={`전체 분량 (${unit})`} required>
                <Input
                  type="number"
                  value={file.totalAmount || ""}
                  disabled={disabled}
                  readOnly
                  aria-label={`${file.name} 전체 분량`}
                />
              </Field>
              <Field label={`실제 검수 범위 (${unit})`} required>
                <Input
                  type="number"
                  value={file.reviewAmount || ""}
                  disabled={disabled}
                  readOnly
                  aria-label={`${file.name} 실제 검수 범위`}
                />
              </Field>
              <Field label="범위 설명">
                <Input
                  placeholder="예: 1~6쪽"
                  value={file.rangeNote ?? ""}
                  disabled={disabled}
                  readOnly
                  aria-label={`${file.name} 범위 설명`}
                />
              </Field>
            </div>
          </div>
        );
      })}
    </>
  );
}
