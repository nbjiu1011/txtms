import type { ReactNode } from "react";
import { Tag } from "@/shared/ui";
import {
  CHANNEL_SPEC_NOTICE,
  formatCount,
  type AlimtalkCheck,
  type ChannelSpec,
  type Measure,
  type SmsCheck,
  type SmsKind,
} from "@/entities/request";
import styles from "./work.module.css";

/**
 * Channel spec counters and warnings of the content editor (§17.3). Warnings never block: they carry a
 * text label ("주의"/"안내") besides the emphasis so they do not rely on color.
 */

export interface SpecNote {
  tone: "warn" | "info";
  text: string;
}

/** One list of spec notes (warnings and the LMS notice). */
export function SpecNotes({ notes }: { notes: SpecNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className={styles.specNotes} aria-label="채널 규격 안내">
      {notes.map((n) => (
        <li key={n.text} className={n.tone === "warn" ? styles.specWarn : styles.specInfo}>
          <Tag variant={n.tone === "warn" ? "hot" : "flag"}>{n.tone === "warn" ? "주의" : "안내"}</Tag>
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The disclaimer shown once under the counters. */
export function ChannelSpecNotice() {
  return <p className={styles.specNotice}>{CHANNEL_SPEC_NOTICE}</p>;
}

function Count({ m, unit, over }: { m: Measure; unit: string; over: boolean }): ReactNode {
  return (
    <>
      <span className={over ? styles.counterOver : undefined}>
        {formatCount(m.raw)}
        {unit}
      </span>
      {m.hasVariables ? (
        <>
          {" · "}
          <span className={over ? styles.counterOver : undefined}>
            예상 {formatCount(m.expected)}
            {unit} (변수 적용)
          </span>
        </>
      ) : null}
    </>
  );
}

/** Over-limit text: the stored length when it is over, else the variable-applied one. */
function overText(label: string, m: Measure, limit: number, unit: string): string {
  if (m.raw > limit) return `${label} ${formatCount(limit)}${unit} 초과 (${formatCount(m.raw)}${unit})`;
  return `변수 적용 시 ${label} ${formatCount(limit)}${unit} 초과 예상 (${formatCount(m.expected)}${unit})`;
}

export function alimtalkNotes(
  check: AlimtalkCheck,
  spec: ChannelSpec["alimtalk"],
  buttons: { name: string }[],
): SpecNote[] {
  const notes: SpecNote[] = [];
  if (check.bodyOver) notes.push({ tone: "warn", text: overText("본문", check.body, spec.bodyMaxChars, "자") });
  if (check.buttonsOver) {
    notes.push({ tone: "warn", text: `버튼 ${formatCount(spec.buttonsMax)}개 초과 (${formatCount(buttons.length)}개)` });
  }
  check.longNames.forEach((long, i) => {
    if (long) {
      notes.push({
        tone: "warn",
        text: `버튼 ${i + 1}: 버튼명 ${formatCount(spec.buttonNameMaxChars)}자 초과 (${buttons[i]?.name ?? ""})`,
      });
    }
  });
  return notes;
}

export function AlimtalkBodyCounter({ check, spec }: { check: AlimtalkCheck; spec: ChannelSpec["alimtalk"] | null }) {
  return (
    <div className={styles.counter} aria-live="polite">
      <Count m={check.body} unit="자" over={check.bodyOver} />{" "}
      {spec ? (
        <Tag>
          본문 최대 {formatCount(spec.bodyMaxChars)}자 · 버튼 {formatCount(spec.buttonsMax)}개 · 버튼명{" "}
          {formatCount(spec.buttonNameMaxChars)}자
        </Tag>
      ) : null}
    </div>
  );
}

export function smsNotes(check: SmsCheck, spec: ChannelSpec["sms"]): SpecNote[] {
  const notes: SpecNote[] = [];
  if (check.kind === "OVER") {
    notes.push({ tone: "warn", text: overText("LMS", check.bytes, spec.lmsMaxBytes, "바이트") });
  } else if (check.kind === "LMS") {
    notes.push({
      tone: "info",
      text: `SMS ${formatCount(spec.smsMaxBytes)}바이트 초과 — LMS 예상 전환 (실제 유형은 바뀌지 않습니다)`,
    });
  }
  if (check.unsupported.length > 0) {
    notes.push({
      tone: "warn",
      text: `${spec.encoding}로 표현할 수 없는 문자: ${check.unsupported.join(", ")} (2바이트로 계산)`,
    });
  }
  return notes;
}

const SMS_KIND_LABEL: Record<SmsKind, string> = { SMS: "SMS", LMS: "LMS 예상", OVER: "LMS 초과" };

export function SmsCounter({ check }: { check: SmsCheck }) {
  return (
    <div className={styles.counter} aria-live="polite">
      <Count m={check.bytes} unit="바이트" over={check.kind === "OVER"} />
      {check.kind ? ` · ${SMS_KIND_LABEL[check.kind]}` : ""} (안내 문구 포함)
    </div>
  );
}
