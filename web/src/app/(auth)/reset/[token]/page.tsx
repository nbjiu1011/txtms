import { Suspense } from "react";
import type { Metadata } from "next";
import { TokenPasswordView } from "@/views/token-password";

export const metadata: Metadata = { title: "비밀번호 재설정 · TX TMS" };

export default function ResetPage({ params }: PageProps<"/reset/[token]">) {
  return (
    <Suspense fallback={<TokenPasswordView kind="PASSWORD_RESET" token={null} />}>
      {params.then(({ token }) => (
        <TokenPasswordView kind="PASSWORD_RESET" token={token} />
      ))}
    </Suspense>
  );
}
