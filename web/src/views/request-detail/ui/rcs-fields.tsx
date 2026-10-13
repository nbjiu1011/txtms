"use client";

import { useId } from "react";
import { cn } from "@/shared/lib";
import { Field, Input, Select, Textarea } from "@/shared/common";
import { MAX_RCS_CARDS, setPayloadField, setRcsCardCount, type RcsPayload } from "@/entities/request";
import { bindText, type FieldsProps } from "./editor-binding";
import styles from "./work.module.css";

/** RCS card image upload while editing a draft. */
export interface CardImageEditing {
  /** Card index whose image is being uploaded. */
  busyIndex: number | null;
  upload: (index: number, file: File) => void;
}

const CARD_COUNTS = Array.from({ length: MAX_RCS_CARDS }, (_, i) => i + 1);

/** RCS cards: count select (1–5) and per-card title, body, image, alt text and button. */
export function RcsFields({ payload, disabled, onPayload, images }: FieldsProps<RcsPayload> & { images?: CardImageEditing }) {
  const id = useId();
  return (
    <>
      <Field label="카드 수" required htmlFor={`${id}-cards`} className={styles.cardsField}>
        <Select
          id={`${id}-cards`}
          value={String(payload.cards.length)}
          disabled={disabled}
          onChange={(e) => onPayload?.(setRcsCardCount(payload, Number(e.target.value)))}
        >
          {CARD_COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      {payload.cards.map((card, i) => (
        <div key={i} className={styles.cardEd}>
          <h4>카드 {i + 1}</h4>
          <Field label="제목" htmlFor={`${id}-${i}-title`}>
            <Input
              id={`${id}-${i}-title`}
              value={card.title}
              disabled={disabled}
              {...bindText(payload, `cards.${i}.title`, onPayload)}
            />
          </Field>
          <Field label="본문" required htmlFor={`${id}-${i}-body`}>
            <Textarea
              id={`${id}-${i}-body`}
              rows={3}
              className={styles.cardBody}
              value={card.body}
              disabled={disabled}
              {...bindText(payload, `cards.${i}.body`, onPayload)}
            />
          </Field>
          <div className={styles.grid2}>
            <Field label="이미지">
              {images && onPayload ? (
                <label className={cn(styles.drop, styles.dropSm)} aria-busy={images.busyIndex === i || undefined}>
                  {images.busyIndex === i ? "업로드 중" : card.imageKey ? "이미지 교체" : "이미지 선택"}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    hidden
                    aria-label={`카드 ${i + 1} 이미지 선택`}
                    disabled={images.busyIndex !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) images.upload(i, file);
                    }}
                  />
                </label>
              ) : (
                <span className={styles.mutedSmall}>{card.imageKey ? "이미지 등록됨" : "이미지 없음"}</span>
              )}
            </Field>
            <Field label="이미지 설명" required={!!card.imageKey} htmlFor={`${id}-${i}-alt`}>
              <Input
                id={`${id}-${i}-alt`}
                placeholder="이미지 내용을 설명"
                value={card.imageAlt}
                disabled={disabled}
                {...bindText(payload, `cards.${i}.imageAlt`, onPayload)}
              />
            </Field>
          </div>
          <div className={styles.grid2}>
            <Field label="버튼명" htmlFor={`${id}-${i}-bn`}>
              <Input
                id={`${id}-${i}-bn`}
                value={card.buttonName}
                disabled={disabled}
                {...bindText(payload, `cards.${i}.buttonName`, onPayload)}
              />
            </Field>
            <Field label="버튼 링크" htmlFor={`${id}-${i}-bl`}>
              <Input
                id={`${id}-${i}-bl`}
                value={card.buttonLink}
                disabled={disabled}
                {...bindText(payload, `cards.${i}.buttonLink`, onPayload)}
              />
            </Field>
          </div>
        </div>
      ))}
    </>
  );
}

/** Sets the uploaded image key of a card. */
export function withCardImage(payload: RcsPayload, index: number, imageKey: string): RcsPayload {
  return setPayloadField(payload, `cards.${index}.imageKey`, imageKey);
}
