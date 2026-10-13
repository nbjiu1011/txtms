"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { isApiError, queryKeys } from "@/shared/api";
import { AUTH_PATHS } from "@/shared/config/routes";
import { Banner } from "@/shared/ui";
import { Button } from "@/shared/common";
import { authApi } from "@/features/auth";
import { AuthLayout, SimpleHero } from "@/widgets/auth-layout";
import styles from "./email-change-view.module.css";

export const EMAIL_CHANGE_INVALID_MESSAGE =
  "유효하지 않거나 만료된 링크입니다. 관리자에게 이메일 변경을 다시 요청하세요.";
export const EMAIL_CHANGED_MESSAGE = "이메일이 변경되었습니다. 새 이메일로 다시 로그인하세요";

export interface EmailChangeViewProps {
  /** null while the route param is resolving. */
  token: string | null;
}

/**
 * `/email-change/[token]` — the link mailed to the new address of an email change. Opening it shows the address;
 * the button applies it (the server ends every session of the user, so the next step is signing in again).
 */
export function EmailChangeView({ token }: EmailChangeViewProps) {
  const router = useRouter();
  const info = useQuery({
    queryKey: queryKeys.detail("auth-tokens", token ?? ""),
    queryFn: () => authApi.tokenInfo(token as string),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });
  const confirm = useMutation({ mutationFn: () => authApi.confirmEmailChange(token as string) });

  const valid = info.data?.valid === true && info.data.kind === "EMAIL_CHANGE";
  const loading = token === null || info.isPending;
  // an expired or used link found only on confirmation reads like an invalid link
  const linkRejected = isApiError(confirm.error) && confirm.error.code === "VALIDATION_FAILED";

  const toLogin = (
    <Button variant={confirm.isSuccess ? "pri" : "ghost"} onClick={() => router.push(AUTH_PATHS.login)}>
      {confirm.isSuccess ? "로그인으로 이동" : "로그인으로 돌아가기"}
    </Button>
  );

  if (confirm.isSuccess) {
    return (
      <AuthLayout hero={<SimpleHero title="이메일 변경 완료" description={EMAIL_CHANGED_MESSAGE} />}>
        <h2 className={styles.title}>이메일이 변경되었습니다</h2>
        <p className={styles.lead} role="status">
          {EMAIL_CHANGED_MESSAGE}
        </p>
        {toLogin}
      </AuthLayout>
    );
  }

  const description = loading
    ? "링크를 확인하고 있습니다."
    : info.isError
      ? "링크를 확인하지 못했습니다. 잠시 후 다시 시도하세요."
      : valid && !linkRejected
        ? "아래 주소를 확인한 뒤 변경을 확정하세요."
        : EMAIL_CHANGE_INVALID_MESSAGE;

  return (
    <AuthLayout hero={<SimpleHero title="이메일 변경 확인" description={description} />}>
      {valid && !linkRejected ? (
        <>
          <h2 className={styles.title}>새 로그인 이메일</h2>
          <p className={styles.lead}>
            {info.data?.name ? `${info.data.name}님의 ` : ""}로그인 이메일이 아래 주소로 바뀝니다. 확인하면 모든 기기에서
            로그아웃됩니다.
          </p>
          <b className={styles.address}>{info.data?.email}</b>
          {confirm.isError ? (
            <Banner tone="danger" role="alert" className={styles.error}>
              {confirm.error.message}
            </Banner>
          ) : null}
          <Button variant="pri" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
            이메일 변경 확인
          </Button>
        </>
      ) : null}
      {toLogin}
    </AuthLayout>
  );
}
