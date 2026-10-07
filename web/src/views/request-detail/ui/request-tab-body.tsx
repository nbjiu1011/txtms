"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, toast } from "@/shared/ui";
import {
  CONTENT_TYPE_LABEL,
  FINAL_STATUSES,
  invalidateRequestViews,
  isBlankContent,
  performableActions,
  requestKeys,
  storeRequestDetail,
  useContentTypes,
  type ContentType,
  type HistoryFilter,
  type RequestAction,
  type RequestDetail,
  type RequestStatus,
} from "@/entities/request";
import { useRequestCreate } from "@/features/request-create";
import { CancelRequestDialog, SubmitRequestDialog } from "@/features/request-workflow";
import type { WorkViewProps } from "@/widgets/app-shell";
import { selectBanners } from "../model/banners";
import { UPLOAD_BUSY_MESSAGE, type DraftEditing } from "../model/use-draft-editing";
import type { RequestPage } from "../model/use-request-page";
import { SaveConflictModal, SaveFailureBanner, ScanDemoPanel } from "./draft-chrome";
import { HistoryTab } from "./history-tab";
import { InfoTab } from "./info-tab";
import { RequestBanners } from "./request-banners";
import { RequestHeader, type DetailSub } from "./request-header";
import { ResultTab } from "./result-tab";
import type { SidePanelTab } from "./side-panel";
import { WorkGrid } from "./work-grid";
import header from "./header.module.css";

const APPROVAL_STATUSES: readonly RequestStatus[] = ["APPROVAL_WAITING", "APPROVED"];

export interface RequestTabBodyProps {
  page: RequestPage;
  meId: number;
  meIsApprover: boolean;
  demo: boolean;
  openTab: WorkViewProps["openTab"];
  editing: DraftEditing;
}

/** Request tab: header with workflow actions, banners and the four sub tabs. */
export function RequestTabBody({ page, meId, meIsApprover, demo, openTab, editing }: RequestTabBodyProps) {
  const r = page.request;
  const client = useQueryClient();
  // The first sub tab is chosen once (a titleless draft opens on 요청 정보) and kept while typing.
  const [sub, setSub] = useState<DetailSub>(() => (r.status === "DRAFT" && !r.title ? "info" : "contents"));
  const [contentKey, setContentKey] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SidePanelTab>("proof");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [dialog, setDialog] = useState<"submit" | "cancel" | null>(null);
  const [pendingType, setPendingType] = useState<ContentType | null>(null);
  const types = useContentTypes();
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });
  const { clone } = useRequestCreate(openRequest);
  const performable = performableActions(r.allowedActions);
  const isFinal = FINAL_STATUSES.includes(r.status);
  const session = editing.canEditRequest ? editing.session : null;
  const title = session ? session.infoValue("title", r) : r.title;
  const current: DetailSub = sub === "result" && !isFinal ? "contents" : sub;
  const approvalEnabled = page.customer?.approvalEnabled ?? APPROVAL_STATUSES.includes(r.status);
  const banners = selectBanners(r, { meId, meIsApprover, name: page.users.name });
  const rowVersion = () => client.getQueryData<RequestDetail>(requestKeys.detail(r.id))?.rowVersion ?? r.rowVersion;
  const reload = () => void client.invalidateQueries({ queryKey: requestKeys.detail(r.id) });
  const applied = (detail: RequestDetail) => {
    storeRequestDetail(client, detail);
    invalidateRequestViews(client, r.id);
    setSub("contents");
  };

  const onAction = (action: RequestAction) => {
    if (action === "SUBMIT") {
      if (editing.uploadBusy) return toast(UPLOAD_BUSY_MESSAGE);
      setDialog("submit");
    } else if (action === "CANCEL") setDialog("cancel");
    else if (action === "CLONE") void clone(r.id);
  };

  const onTypeChange = (type: ContentType) => {
    if (type === r.type || !session) return;
    const filled = r.contents.some((c) => !isBlankContent(r.type, session.content(c)));
    if (filled) setPendingType(type);
    else void editing.changeType(type).then((ok) => ok && setContentKey(null));
  };

  return (
    <>
      <SaveFailureBanner editing={editing} />
      <RequestHeader
        page={page}
        title={title}
        approvalEnabled={approvalEnabled}
        sub={current}
        onSub={setSub}
        performable={performable}
        onAction={onAction}
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
            editing={editing.canEditContent || editing.canEditRequest ? editing : null}
          />
        ) : null}
        {current === "info" ? (
          <InfoTab
            page={page}
            activeTypes={(types.data ?? []).filter((t) => t.active).map((t) => t.type)}
            onOpenRequest={openRequest}
            editing={editing.canEditRequest ? editing : null}
            onTypeChange={onTypeChange}
          />
        ) : null}
        {current === "hist" ? (
          <HistoryTab requestId={r.id} users={page.users} filter={historyFilter} onFilter={setHistoryFilter} />
        ) : null}
        {current === "result" ? <ResultTab page={page} /> : null}
        {demo && editing.canEditContent && (r.type === "FREEFORM" || r.type === "RCS") ? (
          <ScanDemoPanel editing={editing} />
        ) : null}
      </div>
      <SaveConflictModal editing={editing} />
      <SubmitRequestDialog
        open={dialog === "submit"}
        onClose={() => setDialog(null)}
        request={r}
        projectName={page.project?.name ?? ""}
        leadName={page.users.name(r.leadUserId ?? page.project?.leadUserId)}
        rowVersion={rowVersion}
        beforeSubmit={() => editing.session.flush()}
        onSubmitted={(detail) => {
          editing.setFieldErrors([]);
          applied(detail);
        }}
        onInvalid={editing.setFieldErrors}
        onShowMissing={setSub}
        onStale={reload}
      />
      <CancelRequestDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        requestId={r.id}
        rowVersion={rowVersion}
        onCancelled={applied}
        onStale={reload}
      />
      <Modal
        open={pendingType !== null}
        onClose={() => setPendingType(null)}
        title="유형을 바꿀까요?"
        description={
          pendingType
            ? `입력한 콘텐츠 ${r.contents.length}건이 ${CONTENT_TYPE_LABEL[pendingType]} 형식으로 초기화됩니다.`
            : undefined
        }
        okLabel="유형 바꾸기"
        okVariant="warn"
        onOk={async () => {
          if (pendingType && (await editing.changeType(pendingType))) setContentKey(null);
        }}
      />
    </>
  );
}
