/** Users and customer members — contract §2.3, §11. */
import type { Project, ProjectRole } from "@/entities/project/@x/user";
import type { RequestSummary } from "@/entities/request/@x/user";

export interface UserSummary {
  id: number;
  name: string;
  dept: string;
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

export interface MemberInvite {
  email: string;
  name: string;
  dept: string;
  projectId: number;
  role: ProjectRole;
  externalDomainConfirmed: boolean;
}

export interface DeactivationImpact {
  reviewing: RequestSummary[];
  requesting: RequestSummary[];
  leadProjects: Project[];
  lastApproverProjects: Project[];
  lastAdmin: boolean;
}
