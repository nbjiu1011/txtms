"use client";

import { Avatar, Field, Seg } from "@/shared/ui";
import { toggleReviewer, type AssignmentForm } from "../model/assignment-form";
import styles from "./workflow.module.css";

/** A reviewer the lead can assign (active project reviewer, not the requester). */
export interface ReviewerCandidate {
  id: number;
  name: string;
  avatarColor?: string | null;
  /** Active requests of this project (검수 중 · 확인 요청 · 승인 대기). */
  activeCount: number;
}

export interface ReviewerPickerProps {
  candidates: readonly ReviewerCandidate[];
  form: AssignmentForm;
  onChange: (next: AssignmentForm) => void;
}

/** Reviewer checklist + primary segment (reference `reviewerPicker`). */
export function ReviewerPicker({ candidates, form, onChange }: ReviewerPickerProps) {
  const order = candidates.map((c) => c.id);
  const selected = candidates.filter((c) => form.reviewerIds.includes(c.id));
  return (
    <>
      <div className={styles.lbl} id="reviewer-pick-label">
        검수자 (한 명 이상)
      </div>
      <div className={styles.pick} role="group" aria-labelledby="reviewer-pick-label">
        {candidates.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={form.reviewerIds.includes(c.id)}
              onChange={(e) => onChange(toggleReviewer(form, c.id, e.target.checked, order))}
            />
            <Avatar name={c.name} color={c.avatarColor} size={22} />
            {c.name}
            <span className={styles.w}>활성 {c.activeCount}건</span>
          </label>
        ))}
      </div>
      <Field
        className={styles.primaryField}
        label="주담당 검수자"
        required
        hint="한 명만 배정하면 자동으로 주담당이 됩니다. 주담당만 회수 처리와 검수 완료를 할 수 있습니다."
      >
        {selected.length ? (
          <Seg
            label="주담당 검수자"
            options={selected.map((c) => ({ key: String(c.id), label: c.name }))}
            value={form.primaryId === null ? null : String(form.primaryId)}
            onChange={(key) => onChange({ ...form, primaryId: Number(key) })}
          />
        ) : (
          <span className={styles.faintSmall}>검수자를 먼저 고르세요</span>
        )}
      </Field>
    </>
  );
}
