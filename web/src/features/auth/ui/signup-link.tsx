"use client";

import Link from "next/link";
import { AUTH_PATHS } from "@/shared/config/routes";
import { useSignupOptions } from "../model/use-signup-options";
import styles from "./auth-form.module.css";

/** Login page entry to the temporary sign-up; shown only while the API offers sign-up (development server). */
export function SignupLink() {
  const { data } = useSignupOptions();
  if (!data) return null;
  return (
    <p className={styles.signupLink}>
      역할별 테스트 계정이 필요하신가요? <Link href={AUTH_PATHS.signup}>임시 가입</Link>
    </p>
  );
}
