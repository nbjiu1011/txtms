"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeNextPath } from "@/shared/lib";
import { useSessionStore } from "@/entities/me";
import { DemoPersonaList, LoginForm, SignupLink } from "@/features/auth";
import { AuthLayout, LoginHero } from "@/widgets/auth-layout";

function nextPath(): string {
  if (typeof window === "undefined") return "/";
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/**
 * `/login` — hero + email/password form + demo personas (when the API runs in demo mode) + the temporary sign-up link
 * (development server only).
 */
export function LoginView() {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);

  const enterApp = useCallback(() => router.replace(nextPath()), [router]);

  useEffect(() => {
    if (status === "authenticated") enterApp();
  }, [status, enterApp]);

  return (
    <AuthLayout hero={<LoginHero />}>
      <LoginForm onSuccess={enterApp} />
      <DemoPersonaList onSuccess={enterApp} />
      <SignupLink />
    </AuthLayout>
  );
}
