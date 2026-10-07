"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Page, Panel, RoundBadge } from "@/shared/ui";
import { projectRoles } from "@/entities/me";
import { RequestStatusChip } from "@/entities/request";
import { AccessDenied, type WorkViewProps } from "@/widgets/app-shell";
import { UnlockDialog } from "@/features/request-workflow";
import { useDraftEditing, type DraftEditing } from "../model/use-draft-editing";
import { useRequestPage, type RequestPage } from "../model/use-request-page";
import { useRequestCorrection } from "../model/use-request-correction";
import { useRequestWorkflow } from "../model/use-request-workflow";
import { useRevisionEditing, type RevisionEditing } from "../model/use-revision-editing";
import { RevisionConflictModal, SaveConflictModal, SaveFailureBanner } from "./draft-chrome";
import { statusColorStyle } from "./request-header";
import { RequestTabBody } from "./request-tab-body";
import type { SidePanelTab } from "./side-panel";
import { WorkGrid } from "./work-grid";
import header from "./header.module.css";

/**
 * Request detail (`request`) and single-content (`content`) tab. A draft is edited in place by its
 * author (autosave); other states are read-only in this build. Action buttons appear only for
 * actions the server allows and this build implements.
 */
export function RequestDetailView({ tab, me, setTitle, setDirty, openTab }: WorkViewProps) {
  const id = tab.params.id ?? "";
  const state = useRequestPage(id);
  const goHome = () => openTab({ route: "home", params: {} });
  const isContentTab = tab.route === "content";

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
        description={deniedDescription(id, isContentTab, state.draftPrivate)}
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
  return (
    <ReadyBody
      page={state.page}
      tabId={tab.id}
      contentKey={isContentTab ? (tab.params.key ?? "") : null}
      meId={me.id}
      meIsApprover={projectRoles(me, state.page.request.projectId).includes("APPROVER")}
      demo={me.demo}
      openTab={openTab}
      setTitle={setTitle}
      setDirty={setDirty}
    />
  );
}

/** Reference denied texts: someone else's draft vs. a request of a project the user is not in. */
export function deniedDescription(id: string, contentTab: boolean, draftPrivate: boolean): string {
  if (draftPrivate) {
    return contentTab
      ? "작성 중 요청의 콘텐츠는 작성한 요청자만 조회할 수 있습니다."
      : `${id}는 아직 작성 중인 요청입니다. 작성 중 요청은 작성한 요청자만 조회할 수 있습니다.`;
  }
  return contentTab
    ? "프로젝트 구성원과 고객사 관리자만 조회할 수 있습니다."
    : `${id}는 다른 프로젝트의 요청입니다. 프로젝트 구성원과 고객사 관리자만 조회할 수 있습니다.`;
}

interface ReadyBodyProps {
  page: RequestPage;
  tabId: string;
  /** Content tab: the content key; request tab: null. */
  contentKey: string | null;
  meId: number;
  meIsApprover: boolean;
  demo: boolean;
  openTab: WorkViewProps["openTab"];
  setTitle: WorkViewProps["setTitle"];
  setDirty: WorkViewProps["setDirty"];
}

/** Tab dirty marker = unsaved draft edits OR an unsaved review-time revision. */
function useCombinedDirty(setDirty: (dirty: boolean) => void) {
  const parts = useRef({ draft: false, revision: false });
  const target = useRef(setDirty);
  useEffect(() => {
    target.current = setDirty;
  });
  const update = useCallback((part: "draft" | "revision", dirty: boolean) => {
    parts.current[part] = dirty;
    target.current(parts.current.draft || parts.current.revision);
  }, []);
  return useMemo(
    () => ({ draft: (d: boolean) => update("draft", d), revision: (d: boolean) => update("revision", d) }),
    [update],
  );
}

function ReadyBody(props: ReadyBodyProps) {
  const { page, tabId, contentKey, setTitle, setDirty } = props;
  const dirty = useCombinedDirty(setDirty);
  const editing = useDraftEditing(page.request, tabId, dirty.draft);
  const revision = useRevisionEditing(page.request, tabId, props.meId, dirty.revision);
  const r = page.request;
  const requestTitle = editing.canEditRequest ? editing.session.infoValue("title", r) : r.title;
  const content = contentKey === null ? null : r.contents.find((c) => c.key === contentKey);
  const title =
    contentKey === null
      ? requestTitle || "제목 없는 요청"
      : content
        ? editing.session.content(content).title
        : "콘텐츠";

  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);

  if (contentKey === null) {
    return (
      <RequestTabBody
        page={page}
        meId={props.meId}
        meIsApprover={props.meIsApprover}
        demo={props.demo}
        openTab={props.openTab}
        editing={editing}
        revision={revision}
      />
    );
  }
  return (
    <ContentTabBody
      page={page}
      meId={props.meId}
      openTab={props.openTab}
      contentKey={contentKey}
      editing={editing}
      revision={revision}
      title={title}
    />
  );
}

interface ContentTabBodyProps {
  page: RequestPage;
  meId: number;
  openTab: WorkViewProps["openTab"];
  contentKey: string;
  editing: DraftEditing;
  revision: RevisionEditing;
  title: string;
}

function ContentTabBody({ page, meId, openTab, contentKey, editing, revision, title }: ContentTabBodyProps) {
  const r = page.request;
  const [sideTab, setSideTab] = useState<SidePanelTab>("proof");
  const workflow = useRequestWorkflow(page, meId, revision);
  const openContent = (key: string) => openTab({ route: "content", params: { id: r.id, key } });
  const correction = useRequestCorrection({ page, meId, editing, revision, ownKey: contentKey, onOpenContent: openContent });
  const content = r.contents.find((c) => c.key === contentKey);
  return (
    <>
      <SaveFailureBanner editing={editing} />
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
            {r.id} {editing.canEditRequest ? editing.session.infoValue("title", r) : r.title}
          </Link>
        </div>
        <div className={header.reqTitle}>
          <h1>{content ? title : ""}</h1>
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
            onOpenContent={openContent}
            editing={editing.canEditContent ? editing : null}
            revision={revision}
            unlock={workflow.unlock}
            thread={workflow.thread}
            correction={correction}
          />
        ) : (
          <Empty title="콘텐츠가 없습니다" description={`${r.id}에 ${contentKey} 콘텐츠가 없습니다.`} />
        )}
      </div>
      <SaveConflictModal editing={editing} />
      <RevisionConflictModal revision={revision} />
      <UnlockDialog {...workflow.unlockDialog} />
    </>
  );
}
