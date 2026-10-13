"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AUTH_PATHS } from "@/shared/config/routes";
import { Banner, BrandMark, Tag, toast } from "@/shared/ui";
import { Button } from "@/shared/common";
import { SignupForm, useSignupOptions } from "@/features/auth";
import { ServiceFlow, SetupLane } from "./service-flow";
import styles from "./signup-view.module.css";

/**
 * `/signup` — the service flow (who prepares, who requests, who assigns and reviews, who approves) and the
 * temporary sign-up form. The form exists only while the API offers sign-up (demo mode on the development server).
 */
export function SignupView() {
  const router = useRouter();
  const options = useSignupOptions();

  const enterApp = (name: string) => {
    toast(`${name}님, 가입했습니다`);
    router.replace("/");
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href={AUTH_PATHS.login} className={styles.brand} aria-label="TX TMS 로그인으로">
          <BrandMark />
          <b>TMS</b>
        </Link>
        <Tag variant="flag">임시 가입 · 개발 서버</Tag>
        <span className={styles.sp} />
        <Link href={AUTH_PATHS.login} className={styles.login}>
          로그인
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1>누가 요청하고, 누가 배정하고, 누가 검수하나요</h1>
          <p>
            TX TMS에서 요청 하나가 작성부터 완료까지 거치는 단계와 단계별 담당자입니다. 아래에서 역할을 골라 가입하면
            바로 그 역할로 사용해 볼 수 있습니다.
          </p>
          <a href="#signup" className={styles.jump}>
            역할 골라 가입하기 ↓
          </a>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="setup-title">
        <div className={styles.sectionHead}>
          <h2 id="setup-title">준비</h2>
          <p>첫 요청 전에 솔루션 운영 담당자와 고객사 관리자가 고객사와 프로젝트를 준비합니다.</p>
        </div>
        <SetupLane />
      </section>

      <section className={styles.section} aria-labelledby="flow-title">
        <div className={styles.sectionHead}>
          <h2 id="flow-title">업무 흐름</h2>
          <p>요청 상태는 요청 단위입니다. 요청에 담긴 콘텐츠는 모두 같은 상태를 따릅니다.</p>
        </div>
        <ServiceFlow />
      </section>

      <section id="signup" className={styles.section} aria-labelledby="signup-title">
        <div className={styles.sectionHead}>
          <h2 id="signup-title">임시 가입</h2>
          <p>역할마다 계정을 하나씩 만들 수 있습니다. 같은 이메일로는 한 번만 가입됩니다.</p>
        </div>
        <div className={styles.card}>
          {options.isPending ? (
            <p className={styles.muted}>가입 정보를 불러오는 중입니다…</p>
          ) : options.isError ? (
            <Banner
              tone="danger"
              title="가입 정보를 불러오지 못했습니다"
              actions={
                <Button variant="ghost" onClick={() => options.refetch()}>
                  다시 시도
                </Button>
              }
            >
              잠시 후 다시 시도하세요.
            </Banner>
          ) : options.data === null ? (
            <Banner tone="info" title="임시 가입이 열려 있지 않습니다">
              이 서버에서는 가입할 수 없습니다. 관리자에게 초대를 요청하거나{" "}
              <Link href={AUTH_PATHS.login}>로그인</Link>하세요.
            </Banner>
          ) : (
            <SignupForm customers={options.data.customers} onSuccess={enterApp} />
          )}
        </div>
      </section>
    </main>
  );
}
