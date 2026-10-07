"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Empty, Page, Panel, RoundBadge } from "@/shared/ui";
import { projectRoles } from "@/entities/me";
import {
  FINAL_STATUSES,
  RequestStatusChip,
  performableActions,
  useContentTypes,
  type HistoryFilter,
  type RequestStatus,
} from "@/entities/request";
import { AccessDenied, type WorkViewProps } from "@/widgets/app-shell";
import { selectBanners } from "../model/banners";
import { useRequestPage, type RequestPage } from "../model/use-request-page";
import { HistoryTab } from "./history-tab";
import { InfoTab } from "./info-tab";
import { RequestBanners } from "./request-banners";
import { RequestHeader, statusColorStyle, type DetailSub } from "./request-header";
import { ResultTab } from "./result-tab";
import type { SidePanelTab } from "./side-panel";
import { WorkGrid } from "./work-grid";
import header from "./header.module.css";

const APPROVAL_STATUSES: readonly RequestStatus[] = ["APPROVAL_WAITING", "APPROVED"];

/**
 * Request detail (`request`) and single-content (`content`) tab. Read-only in this build: action
 * buttons appear only for actions the server allows and this build implements.
 */
export function RequestDetailView({ tab, me, setTitle, openTab }: WorkViewProps) {
  const id = tab.params.id ?? "";
  const state = useRequestPage(id);
  const goHome = () => openTab({ route: "home", params: {} });
  const isContentTab = tab.route === "content";
  const ready = state.kind === "ready" ? state.page : null;
  const title = ready
    ? isContentTab
      ? (ready.request.contents.find((c) => c.key === tab.params.key)?.title ?? "콘텐츠")
      : ready.request.title || "제목 없는 요청"
    : null;

  useEffect(() => {
    if (title !== null) setTitle(title);
  }, [title, setTitle]);

  if (state.kind === "loading") {
    return (
      <Page>
        <Empty plain title="요청을 불러오는 중입니다" />
      </Page>
    );
  }
  if (state.kind === "notFound") {
    return <AccessDenied title="요청을 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다." onGoHome={goHome} />;
  }
  if (state.kind === "forbidden") {
    return (
      <AccessDenied
        title={isContentTab ? "이 콘텐츠에 접근할 권한이 없습니다" : "이 요청에 접근할 권한이 없습니다"}
        description={`${id}는 프로젝트 구성원과 고객사 관리자만 조회할 수 있습니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다.`}
        onGoHome={goHome}
      />
    );
  }
  if (state.kind === "error") {
    return (
      <Page>
        <Panel>
          <Empty
            title="요청을 불러오지 못했습니다"
            description={state.message}
            action={<Button onClick={state.retry}>다시 시도</Button>}
          />
        </Panel>
      </Page>
    );
  }
  const view = { page: state.page, meId: me.id, openTab };
  return isContentTab ? (
    <ContentTabBody {...view} contentKey={tab.params.key ?? ""} />
  ) : (
    <RequestTabBody {...view} meIsApprover={projectRoles(me, state.page.request.projectId).includes("APPROVER")} />
  );
}

interface BodyProps {
  page: RequestPage;
  meId: number;
  openTab: WorkViewProps["openTab"];
}

function RequestTabBody({ page, meId, meIsApprover, openTab }: BodyProps & { meIsApprover: boolean }) {
  const r = page.request;
  const [sub, setSub] = useState<DetailSub | null>(null);
  const [contentKey, setContentKey] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SidePanelTab>("proof");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const types = useContentTypes();
  const performable = performableActions(r.allowedActions);
  const isFinal = FINAL_STATUSES.includes(r.status);
  const defaultSub: DetailSub = r.status === "DRAFT" && !r.title ? "info" : "contents";
  const current: DetailSub = sub === "result" && !isFinal ? "contents" : (sub ?? defaultSub);
  const approvalEnabled = page.customer?.approvalEnabled ?? APPROVAL_STATUSES.includes(r.status);
  const banners = selectBanners(r, { meId, meIsApprover, name: page.users.name });
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });

  return (
    <>
      <RequestHeader
        page={page}
        approvalEnabled={approvalEnabled}
        sub={current}
        onSub={setSub}
        performable={performable}
        onAction={() => undefined}
        onOpenRequest={openRequest}
        onOpenList={() => openTab({ route: "requests", params: {} })}
      />
      <div className={header.reqBody}>
        <RequestBanners
          banners={banners}
          performable={performable}
          onAnswer={() => {
            setSub("contents");
            setSideTab("ask");
          }}
          onShowResult={() => setSub("result")}
          onDecideRecall={() => undefined}
        />
        {current === "contents" ? (
          <WorkGrid
            page={page}
            meId={meId}
            contentKey={contentKey}
            onSelectContent={setContentKey}
            sideTab={sideTab}
            onSideTab={setSideTab}
            onOpenContent={(key) => openTab({ route: "content", params: { id: r.id, key } })}
          />
        ) : null}
        {current === "info" ? (
          <InfoTab
            page={page}
            activeTypes={(types.data ?? []).filter((t) => t.active).map((t) => t.type)}
            onOpenRequest={openRequest}
          />
        ) : null}
        {current === "hist" ? (
          <HistoryTab requestId={r.id} users={page.users} filter={historyFilter} onFilter={setHistoryFilter} />
        ) : null}
        {current === "result" ? <ResultTab page={page} /> : null}
      </div>
    </>
  );
}

function ContentTabBody({ page, meId, openTab, contentKey }: BodyProps & { contentKey: string }) {
  const r = page.request;
  const [sideTab, setSideTab] = useState<SidePanelTab>("proof");
  const content = r.contents.find((c) => c.key === contentKey);
  return (
    <>
      <div className={`${header.reqHead} ${header.contentHead}`} style={statusColorStyle(r)}>
        <div className={header.crumb}>
          <Link
            href={`/requests/${encodeURIComponent(r.id)}`}
            scroll={false}
            onNavigate={(e) => {
              e.preventDefault();
              openTab({ route: "request", params: { id: r.id } });
            }}
          >
            {r.id} {r.title}
          </Link>
        </div>
        <div className={header.reqTitle}>
          <h1>{content?.title ?? ""}</h1>
          <RequestStatusChip status={r.status} />
          <RoundBadge>{r.round}차</RoundBadge>
        </div>
      </div>
      <div className={header.reqBody}>
        {content ? (
          <WorkGrid
            page={page}
            meId={meId}
            contentKey={contentKey}
            onSelectContent={() => undefined}
            single
            sideTab={sideTab}
            onSideTab={setSideTab}
            onOpenContent={(key) => openTab({ route: "content", params: { id: r.id, key } })}
          />
        ) : (
          <Empty title="콘텐츠가 없습니다" description={`${r.id}에 ${contentKey} 콘텐츠가 없습니다.`} />
        )}
      </div>
    </>
  );
}
