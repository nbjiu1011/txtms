"use client";

import { AppShell, type WorkViewRegistry } from "@/widgets/app-shell";
import { AdminCustomerView } from "@/views/admin-customer";
import { AdminNoticesView } from "@/views/admin-notices";
import { AdminProjectsView } from "@/views/admin-projects";
import { AdminUsersView } from "@/views/admin-users";
import { AdminVariablesView } from "@/views/admin-variables";
import { ApprovalView } from "@/views/approval";
import { ContentArchiveView } from "@/views/content-archive";
import { DashboardView } from "@/views/dashboard";
import { NoticesView } from "@/views/notices";
import { PerformanceView } from "@/views/performance";
import { ProfileView } from "@/views/profile";
import { RequestDetailView } from "@/views/request-detail";
import { RequestListView } from "@/views/request-list";
import { ReviewView } from "@/views/review";

/** Route → tab view registry. Only implemented views are registered. */
const VIEWS: WorkViewRegistry = {
  home: DashboardView,
  requests: RequestListView,
  request: RequestDetailView,
  content: RequestDetailView,
  review: ReviewView,
  approval: ApprovalView,
  contents: ContentArchiveView,
  performance: PerformanceView,
  notices: NoticesView,
  adminProjects: AdminProjectsView,
  adminVariables: AdminVariablesView,
  adminUsers: AdminUsersView,
  adminCustomer: AdminCustomerView,
  adminNotices: AdminNoticesView,
  profile: ProfileView,
};

export function Workspace() {
  return <AppShell views={VIEWS} />;
}
