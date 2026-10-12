import type { Metadata } from "next";
import { SignupView } from "@/views/signup";

export const metadata: Metadata = { title: "임시 가입 · TX TMS" };

export default function SignupPage() {
  return <SignupView />;
}
