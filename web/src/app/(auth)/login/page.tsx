import type { Metadata } from "next";
import { LoginView } from "@/views/login";

export const metadata: Metadata = { title: "로그인 · TX TMS" };

export default function LoginPage() {
  return <LoginView />;
}
