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
  /**
   * Demo persona session (only when the API enables one-click persona login) — the persona switcher is shown
   * only when true. Email/password sessions are always false.
   */
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

export type AuthTokenKind = "INVITATION" | "PASSWORD_RESET" | "EMAIL_CHANGE";

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

/** `PUT /api/me/password` body. */
export interface PasswordChangeBody {
  currentPassword: string;
  newPassword: string;
}

/** Temporary sign-up role (`POST /api/auth/signup`, demo mode only). */
export type SignupRole = "REQUESTER" | "REVIEWER" | "LEAD_REVIEWER" | "APPROVER" | "CUSTOMER_ADMIN" | "OPERATOR";

/** `POST /api/auth/signup` body. `customerId`/`projectId` are null where the role does not need them. */
export interface SignupBody {
  name: string;
  email: string;
  password: string;
  role: SignupRole;
  customerId: number | null;
  projectId: number | null;
}

export interface SignupProject {
  id: number;
  name: string;
  /** Current lead reviewer (null when the project has none). */
  leadName: string | null;
}

export interface SignupCustomer {
  id: number;
  name: string;
  approvalEnabled: boolean;
  projects: SignupProject[];
}

/** `GET /api/auth/signup-options`: active customers and their active projects. */
export interface SignupOptions {
  customers: SignupCustomer[];
}
