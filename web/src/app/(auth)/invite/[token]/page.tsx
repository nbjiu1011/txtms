import { Suspense } from "react";
import type { Metadata } from "next";
import { TokenPasswordView } from "@/views/token-password";

export const metadata: Metadata = { title: "초대 수락 · TX TMS" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<TokenPasswordView kind="INVITATION" token={null} />}>
      {params.then(({ token }) => (
        <TokenPasswordView kind="INVITATION" token={token} />
      ))}
    </Suspense>
  );
}
