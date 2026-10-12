import { http } from "@/shared/api";
import type {
  AuthSession,
  AuthTokenInfo,
  DemoPersona,
  LoginBody,
  PasswordResetRequestBody,
  SignupBody,
  SignupOptions,
  TokenPasswordBody,
} from "@/entities/me";

/** Auth endpoints (contract §1). Public endpoints skip the bearer/refresh handling. */
export const authApi = {
  login: (body: LoginBody) => http.post<AuthSession>("/auth/login", body, { auth: false }),
  demoLogin: (userId: number) => http.post<AuthSession>("/auth/demo-login", { userId }, { auth: false }),
  demoPersonas: () => http.get<DemoPersona[]>("/auth/demo-personas", { auth: false }),
  logout: () => http.post<void>("/auth/logout"),
  requestPasswordReset: (body: PasswordResetRequestBody) =>
    http.post<void>("/auth/password-reset-requests", body, { auth: false }),
  tokenInfo: (token: string) => http.get<AuthTokenInfo>(`/auth/tokens/${encodeURIComponent(token)}`, { auth: false }),
  signupOptions: () => http.get<SignupOptions>("/auth/signup-options", { auth: false }),
  signup: (body: SignupBody) => http.post<AuthSession>("/auth/signup", body, { auth: false }),
  setTokenPassword: (token: string, body: TokenPasswordBody) =>
    http.post<AuthSession>(`/auth/tokens/${encodeURIComponent(token)}/password`, body, { auth: false }),
  /** Applies an email change from the link mailed to the new address (204; every session of the user ends). */
  confirmEmailChange: (token: string) =>
    http.post<void>(`/auth/tokens/${encodeURIComponent(token)}/email-change`, undefined, { auth: false }),
};
