import { Suspense } from "react";
import type { Metadata } from "next";
import { EmailChangeView } from "@/views/email-change";

export const metadata: Metadata = { title: "이메일 변경 확인 · TX TMS" };

export default function EmailChangePage({ params }: PageProps<"/email-change/[token]">) {
  return (
    <Suspense fallback={<EmailChangeView token={null} />}>
      {params.then(({ token }) => (
        <EmailChangeView token={token} />
      ))}
    </Suspense>
  );
}
