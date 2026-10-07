"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/shared/api";
import { AUTH_PATHS } from "@/shared/config/routes";
import { Button } from "@/shared/ui";
import type { AuthTokenKind } from "@/entities/me";
import { authApi, TokenPasswordForm } from "@/features/auth";
import { AuthLayout, SimpleHero } from "@/widgets/auth-layout";

export const INVALID_LINK_MESSAGE = "유효하지 않거나 만료된 링크입니다. 관리자에게 재발급을 요청하세요.";

const TITLE: Record<AuthTokenKind, string> = {
  INVITATION: "초대 수락",
  PASSWORD_RESET: "비밀번호 재설정",
};

export interface TokenPasswordViewProps {
  /** Page the link was opened from (`/invite/…` or `/reset/…`). */
  kind: AuthTokenKind;
  /** null while the route param is resolving. */
  token: string | null;
}

/** `/invite/[token]`, `/reset/[token]` — set a password from a one-time link and sign in. */
export function TokenPasswordView({ kind, token }: TokenPasswordViewProps) {
  const router = useRouter();
  const info = useQuery({
    queryKey: queryKeys.detail("auth-tokens", token ?? ""),
    queryFn: () => authApi.tokenInfo(token as string),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  });

  const resolvedKind = info.data?.kind ?? kind;
  const valid = info.data?.valid === true;
  const loading = token === null || info.isPending;

  // An invalid link answers 200 `{ valid: false }`; an error means the check itself failed.
  const description = loading
    ? "링크를 확인하고 있습니다."
    : info.isError
      ? "링크를 확인하지 못했습니다. 잠시 후 다시 시도하세요."
      : valid
        ? (info.data?.email ?? "")
        : INVALID_LINK_MESSAGE;

  return (
    <AuthLayout hero={<SimpleHero title={TITLE[resolvedKind]} description={description} />}>
      {valid && token ? (
        <TokenPasswordForm
          token={token}
          kind={resolvedKind}
          defaultName={info.data?.name ?? ""}
          onSuccess={() => router.replace("/")}
        />
      ) : null}
      <Button variant="ghost" onClick={() => router.push(AUTH_PATHS.login)}>
        로그인으로 돌아가기
      </Button>
    </AuthLayout>
  );
}
