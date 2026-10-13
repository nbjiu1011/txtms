"use client";

import { AppShell, type WorkViewProps, type WorkViewRegistry } from "@/widgets/app-shell";
import { AdminCustomerView } from "@/views/admin-customer";
import { AdminNoticesView } from "@/views/admin-notices";
import { AdminProjectsView } from "@/views/admin-projects";
import { AdminUserDetailView } from "@/views/admin-user-detail";
import { AdminUsersView } from "@/views/admin-users";
import { AdminVariablesView } from "@/views/admin-variables";
import { ApprovalView } from "@/views/approval";
import { ContentArchiveView } from "@/views/content-archive";
import { DashboardView } from "@/views/dashboard";
import { AdminNoticeDetailView, NoticeDetailView } from "@/views/notice-detail";
import { NoticesView } from "@/views/notices";
import { OpsCustomerDetailView, OpsCustomersView } from "@/views/ops-customers";
import { OpsHomeView } from "@/views/ops-home";
import { OpsSetupView } from "@/views/ops-setup";
import { OpsStandardsView } from "@/views/ops-standards";
import { PerformanceView } from "@/views/performance";
import { ProfileView } from "@/views/profile";
import { RequestDetailView } from "@/views/request-detail";
import { RequestListView } from "@/views/request-list";
import { ReviewView } from "@/views/review";

/** 대시보드: the operator dashboard for solution operators, the role dashboard for everyone else. */
function HomeView(props: WorkViewProps) {
  return props.me.operator ? <OpsHomeView {...props} /> : <DashboardView {...props} />;
}

/** Route → tab view registry. Only implemented views are registered. */
const VIEWS: WorkViewRegistry = {
  home: HomeView,
  requests: RequestListView,
  request: RequestDetailView,
  content: RequestDetailView,
  review: ReviewView,
  approval: ApprovalView,
  contents: ContentArchiveView,
  performance: PerformanceView,
  notices: NoticesView,
  notice: NoticeDetailView,
  adminProjects: AdminProjectsView,
  adminVariables: AdminVariablesView,
  adminUsers: AdminUsersView,
  adminUser: AdminUserDetailView,
  adminCustomer: AdminCustomerView,
  adminNotices: AdminNoticesView,
  adminNotice: AdminNoticeDetailView,
  opsCustomers: OpsCustomersView,
  opsCustomer: OpsCustomerDetailView,
  opsSetup: OpsSetupView,
  opsStandards: OpsStandardsView,
  profile: ProfileView,
};

export function Workspace() {
  return <AppShell views={VIEWS} />;
}
