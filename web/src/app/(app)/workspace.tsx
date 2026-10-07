"use client";

import { AppShell, type WorkViewRegistry } from "@/widgets/app-shell";
import { ApprovalView } from "@/views/approval";
import { ContentArchiveView } from "@/views/content-archive";
import { DashboardView } from "@/views/dashboard";
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
  profile: ProfileView,
};

export function Workspace() {
  return <AppShell views={VIEWS} />;
}
