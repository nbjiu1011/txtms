/** Authenticated user and auth payloads — contract §1. */
import type { ProjectRole } from "@/entities/project/@x/me";

export interface Membership {
  projectId: number;
  customerId: number;
  roles: ProjectRole[];
  /** Lead reviewer (대표 검수자) of the project. */
  lead: boolean;
}

export interface MeSession {
  remember: boolean;
  expiresAt: string;
}

export interface Me {
  id: number;
  name: string;
  /** Null for a user invited without a department. */
  dept: string | null;
  email: string;
  customerId: number | null;
  /** Solution operator (솔루션 운영 담당자). */
  operator: boolean;
  adminCustomerIds: number[];
  avatarColor: string;
  /** Demo persona session — the persona switcher is shown only when true. */
  demo: boolean;
  memberships: Membership[];
  session: MeSession;
}

export interface AuthSession {
  accessToken: string;
  me: Me;
}

export interface LoginBody {
  email: string;
  password: string;
  remember: boolean;
}

export interface DemoPersona {
  userId: number;
  name: string;
  roleLabel: string;
  description: string;
  avatarColor: string;
}

export type AuthTokenKind = "INVITATION" | "PASSWORD_RESET";

export interface AuthTokenInfo {
  kind: AuthTokenKind;
  valid: boolean;
  email?: string;
  name?: string;
}

export interface TokenPasswordBody {
  name: string;
  password: string;
}

export interface PasswordResetRequestBody {
  email: string;
}

export type MePatch = Pick<Me, "name" | "dept">;
