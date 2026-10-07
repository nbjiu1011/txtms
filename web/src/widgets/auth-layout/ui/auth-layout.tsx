import type { ReactNode } from "react";
import { AvatarStack, BrandMark, RoundBadge, StatusChip, TypeChip } from "@/shared/ui";
import styles from "./auth-layout.module.css";

export interface AuthLayoutProps {
  hero: ReactNode;
  children: ReactNode;
}

/** `.login` — navy hero on the left, form panel on the right (single column ≤860px). */
export function AuthLayout({ hero, children }: AuthLayoutProps) {
  return (
    <div className={styles.login}>
      {hero}
      <section className={styles.panel}>{children}</section>
    </div>
  );
}

const FLOW = ["작성 중", "배정 대기", "검수 중", "확인 요청", "승인 대기", "완료"] as const;
const FLOW_CURRENT = "검수 중";

/** Static illustration people for the proof card (not live data). */
const ILLUSTRATION_REVIEWERS = [
  { name: "박지훈", color: "var(--avatar-2)" },
  { name: "한가을", color: "var(--avatar-6)" },
  { name: "이도현", color: "var(--avatar-3)" },
];

/** Login hero: brand, headline, proof-card illustration and the request status flow. */
export function LoginHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.brandRow}>
        <BrandMark inverse />
        <b>TMS</b>
      </div>
      <h1>
        보내기 전의 문안을
        <br />
        한곳에서 검수하고
        <br />
        완료합니다
      </h1>
      <p className={styles.lead}>
        알림톡, 문자, RCS, 자유입력 콘텐츠를 요청 단위로 묶어 배정, 검수, 선택 승인, 완료 보관까지 진행합니다.
      </p>
      <div className={styles.heroProof} aria-hidden="true">
        <div className={`${styles.hpCard} ${styles.hpBack}`}>
          <div className={styles.hpLine} />
          <div className={`${styles.hpLine} ${styles.short}`} />
          <div className={styles.hpLine} />
        </div>
        <div className={styles.hpCard}>
          <div className={styles.hpTop}>
            <TypeChip tone="a" label="알림톡" showLabel />
            <StatusChip tone="review">검수 중</StatusChip>
            <RoundBadge>2차</RoundBadge>
          </div>
          <p className={styles.hpText}>
            고객님, 10월 한 달 동안 결제하시면 포인트가 적립 <del>되요</del>
            <ins>돼요</ins>. 아래 버튼을 <del>클릭</del>
            <ins>선택</ins>하세요.
          </p>
          <div className={styles.hpFoot}>
            <AvatarStack people={ILLUSTRATION_REVIEWERS} />
            <span>공동 검수 3명</span>
            <span className={styles.sp} />
            <span className={styles.hpOk}>주담당 확인</span>
          </div>
        </div>
      </div>
      <div className={styles.flow}>
        {FLOW.map((step) => (
          <span key={step} className={step === FLOW_CURRENT ? styles.k : undefined}>
            {step}
          </span>
        ))}
      </div>
    </section>
  );
}

export interface SimpleHeroProps {
  title: string;
  description: ReactNode;
}

/** Hero used by the invitation / password reset page: headline and one line of context. */
export function SimpleHero({ title, description }: SimpleHeroProps) {
  return (
    <section className={styles.hero}>
      <h1>{title}</h1>
      <p className={styles.lead}>{description}</p>
    </section>
  );
}
