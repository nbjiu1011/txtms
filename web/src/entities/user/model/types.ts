/** Users and customer members — contract §2.3, §11. */
import type { Project, ProjectRole } from "@/entities/project/@x/user";
import type { RequestSummary } from "@/entities/request/@x/user";

export interface UserSummary {
  id: number;
  name: string;
  /** Null for a user invited without a department (contract §14.6). */
  dept: string | null;
  email: string;
  active: boolean;
  avatarColor: string;
}

export interface MemberProject {
  projectId: number;
  roles: ProjectRole[];
  lead: boolean;
}

export interface Member {
  user: UserSummary;
  pending: boolean;
  admin: boolean;
  projects: MemberProject[];
  invitationExpiresAt: string | null;
}

/** `POST /api/customers/{id}/invitations` body. */
export interface MemberInvite {
  email: string;
  name: string;
  dept: string;
  projectId: number | null;
  role: ProjectRole | null;
  externalDomainConfirmed: boolean;
}

export interface DeactivationImpact {
  reviewing: RequestSummary[];
  requesting: RequestSummary[];
  leadProjects: Project[];
  lastApproverProjects: Project[];
  lastAdmin: boolean;
  /** Usable substitutes: active, accepted users other than the target holding a reviewer role (contract §15). */
  substitutes: Member[];
}
