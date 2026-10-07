/** Dashboard, workload and performance — contract §9. */
import type { NoticeSummary } from "@/entities/notice/@x/dashboard";
import type {
  ContentType,
  FileAmount,
  RequestListView,
  RequestStatus,
  RequestSummary,
} from "@/entities/request/@x/dashboard";

export interface DashboardKpi {
  view: RequestListView;
  label: string;
  /** Tone key expressed as a request status (UI maps to `--s-*`). */
  tone: RequestStatus;
  count: number;
}

export interface PipelineItem {
  status: RequestStatus;
  count: number;
}

export interface DashboardTodo {
  requestId: string;
  /** RequestAction the user has to perform. */
  action: string;
  label: string;
  tone: RequestStatus;
  title: string;
  type: ContentType;
  projectName: string;
  dueDate: string | null;
  overdue: boolean;
  dueSoon: boolean;
}

export interface WorkloadRow {
  userId: number;
  active: number;
  primary: number;
  dueSoonOrOverdue: number;
  chars: number;
  files: FileAmount[];
}

export interface Dashboard {
  kpis: DashboardKpi[];
  pipeline: PipelineItem[];
  pipelineTotal: number;
  todos: DashboardTodo[];
  recent: RequestSummary[];
  workload: WorkloadRow[];
  notices: NoticeSummary[];
  /** Customer admin viewing a project they are not a member of. */
  adminViewing: boolean;
}

export interface PerformancePerson {
  userId: number;
  completedAsPrimary: number;
  coReviewed: number;
  assignmentsManaged: number;
  active: number;
}

export interface Performance {
  received: number;
  receivedContents: number;
  receivedCompleted: number;
  /** null when the denominator is 0 (shown as `–`). */
  completionRate: number | null;
  completedInPeriod: number;
  completedContents: number;
  inProgress: number;
  people: PerformancePerson[];
  workload: WorkloadRow[];
}

export interface PerformanceParams {
  customerId?: number;
  projectId?: number;
  from?: string;
  to?: string;
  userId?: number;
}
