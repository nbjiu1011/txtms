"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/ui";
import { Modal } from "@/shared/common";
import {
  CONTENT_TYPE_LABEL,
  FINAL_STATUSES,
  invalidateRequestViews,
  isBlankContent,
  requestApi,
  useContentTypes,
  useRequestActionIntent,
  type ContentType,
  type HistoryFilter,
  type RequestAction,
  type RequestDetail,
  type RequestStatus,
} from "@/entities/request";
import { useRequestCreate } from "@/features/request-create";
import {
  CancelRequestDialog,
  DeleteRequestDialog,
  SubmitRequestDialog,
  UnlockDialog,
  checkBeforeComplete,
  handleWorkflowError,
} from "@/features/request-workflow";
import { closeRequestTabs, type WorkViewProps } from "@/widgets/app-shell";
import { selectBanners } from "../model/banners";
import { UPLOAD_BUSY_MESSAGE, type DraftEditing } from "../model/use-draft-editing";
import type { RequestPage } from "../model/use-request-page";
import { useRequestCorrection } from "../model/use-request-correction";
import { useRequestWorkflow } from "../model/use-request-workflow";
import type { RevisionEditing } from "../model/use-revision-editing";
import { RevisionConflictModal, SaveConflictModal, SaveFailureBanner, ScanDemoPanel } from "./draft-chrome";
import { HistoryTab } from "./history-tab";
import { InfoTab } from "./info-tab";
import { RequestBanners } from "./request-banners";
import { RequestHeader, type DetailSub } from "./request-header";
import { ResultTab } from "./result-tab";
import type { SidePanelTab } from "./side-panel";
import { WorkGrid } from "./work-grid";
import { WorkflowDialogs, type WorkflowDialog } from "./workflow-dialogs";
import header from "./header.module.css";

const APPROVAL_STATUSES: readonly RequestStatus[] = ["APPROVAL_WAITING", "APPROVED"];

/** Header action → modal (submit / cancel / clone / follow-up / complete are handled separately). */
const ACTION_DIALOG: Partial<Record<RequestAction, WorkflowDialog>> = {
  ASSIGN: { kind: "assign" },
  CHANGE_ASSIGNMENT: { kind: "change" },
  EDIT_DUE: { kind: "due" },
  RECALL: { kind: "recall" },
  APPROVE: { kind: "approve" },
  REVISE: { kind: "revise" },
};

export interface RequestTabBodyProps {
  page: RequestPage;
  meId: number;
  meIsApprover: boolean;
  demo: boolean;
  openTab: WorkViewProps["openTab"];
  editing: DraftEditing;
  revision: RevisionEditing;
}

/** Request tab: header with workflow actions, banners and the four sub tabs. */
export function RequestTabBody({ page, meId, meIsApprover, demo, openTab, editing, revision }: RequestTabBodyProps) {
  const r = page.request;
  // The first sub tab is chosen once (a titleless draft opens on 요청 정보) and kept while typing.
  const [sub, setSub] = useState<DetailSub>(() => (r.status === "DRAFT" && !r.title ? "info" : "contents"));
  const [contentKey, setContentKey] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SidePanelTab>("proof");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [dialog, setDialog] = useState<"submit" | "cancel" | "delete" | null>(null);
  const client = useQueryClient();
  const [flow, setFlow] = useState<WorkflowDialog | null>(null);
  const [pendingType, setPendingType] = useState<ContentType | null>(null);
  const types = useContentTypes();
  const openRequest = (id: string) => openTab({ route: "request", params: { id } });
  const { clone, followUp } = useRequestCreate(openRequest);
  const workflow = useRequestWorkflow(page, meId, revision);
  const { performable } = workflow;
  const correction = useRequestCorrection({
    page,
    meId,
    editing,
    revision,
    ownKey: null,
    onSelectContent: setContentKey,
  });
  const isFinal = FINAL_STATUSES.includes(r.status);
  const session = editing.canEditRequest ? editing.session : null;
  const title = session ? session.infoValue("title", r) : r.title;
  const current: DetailSub = sub === "result" && !isFinal ? "contents" : sub;
  const approvalEnabled = page.customer?.approvalEnabled ?? APPROVAL_STATUSES.includes(r.status);
  const banners = selectBanners(r, { meId, meIsApprover, name: page.users.name });
  const applied = (detail: RequestDetail) => {
    workflow.applied(detail);
    setSub("contents");
  };

  const complete = () => {
    const check = checkBeforeComplete(r, { meId, approvalEnabled, hasUnsavedRevision: revision.session.hasAny() });
    if (check.kind === "blocked") return toast(check.message);
    if (check.kind === "confirm") return setFlow({ kind: "complete" });
    // No eligible approver: the server records the block and notifies the admins, then refuses.
    void requestApi.complete(r.id, workflow.rowVersion()).then(applied, (error: unknown) => {
      handleWorkflowError(error, workflow.reload);
    });
  };

  const onAction = (action: RequestAction) => {
    if (action === "SUBMIT") {
      if (editing.uploadBusy) return toast(UPLOAD_BUSY_MESSAGE);
      setDialog("submit");
    } else if (action === "CANCEL") setDialog("cancel");
    else if (action === "DELETE") setDialog("delete");
    else if (action === "CLONE") void clone(r.id);
    else if (action === "FOLLOW_UP") void followUp(r.id, null);
    else if (action === "COMPLETE") complete();
    else {
      const next = ACTION_DIALOG[action];
      if (next) setFlow(next);
    }
  };

  // 배정 from the 검수 screen opens this tab and asks for the assignment modal: the pending intent
  // shows its modal until it is closed (an intent the user can no longer perform is dropped).
  const intent = useRequestActionIntent((s) => s.intents[r.id] ?? null);
  const intentFlow = intent && performable.has(intent) ? (ACTION_DIALOG[intent] ?? null) : null;
  useEffect(() => {
    if (intent && !intentFlow) useRequestActionIntent.getState().consume(r.id);
  }, [intent, intentFlow, r.id]);
  const activeFlow = flow ?? intentFlow;
  const closeFlow = () => {
    setFlow(null);
    if (intent) useRequestActionIntent.getState().consume(r.id);
  };

  const onFlowDone = (done: WorkflowDialog) => {
    setSub("contents");
    if (done.kind === "decide" && done.approve) {
      // The primary reviewer can no longer see the request (it is the requester's draft again).
      toast("회수를 승인했습니다. 요청이 작성 중으로 돌아갔습니다");
      openTab({ route: "review", params: {} });
    }
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
          onDecideRecall={(approve) => setFlow({ kind: "decide", approve })}
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
            revision={revision}
            unlock={workflow.unlock}
            thread={workflow.thread}
            correction={correction}
          />
        ) : null}
        {current === "info" ? (
          <InfoTab
            page={page}
            activeTypes={(types.data ?? []).filter((t) => t.active).map((t) => t.type)}
            onOpenRequest={openRequest}
            editing={editing.canEditRequest ? editing : null}
            onTypeChange={onTypeChange}
            onEditDue={performable.has("EDIT_DUE") ? () => setFlow({ kind: "due" }) : undefined}
          />
        ) : null}
        {current === "hist" ? (
          <HistoryTab requestId={r.id} users={page.users} filter={historyFilter} onFilter={setHistoryFilter} />
        ) : null}
        {current === "result" ? (
          <ResultTab page={page} performable={performable} onFollowUp={(key) => void followUp(r.id, key)} />
        ) : null}
        {demo && editing.canEditContent && (r.type === "FREEFORM" || r.type === "RCS") ? (
          <ScanDemoPanel editing={editing} />
        ) : null}
      </div>
      <SaveConflictModal editing={editing} />
      <RevisionConflictModal revision={revision} />
      <UnlockDialog {...workflow.unlockDialog} />
      <WorkflowDialogs
        page={page}
        meId={meId}
        approvalEnabled={approvalEnabled}
        workflow={workflow}
        dialog={activeFlow}
        onClose={closeFlow}
        onDone={(done) => {
          closeFlow();
          onFlowDone(done);
        }}
      />
      <SubmitRequestDialog
        open={dialog === "submit"}
        onClose={() => setDialog(null)}
        request={r}
        projectName={page.project?.name ?? ""}
        leadName={page.users.name(r.leadUserId ?? page.project?.leadUserId)}
        rowVersion={workflow.rowVersion}
        beforeSubmit={() => editing.session.flush()}
        onSubmitted={(detail) => {
          editing.setFieldErrors([]);
          applied(detail);
        }}
        onInvalid={editing.setFieldErrors}
        onShowMissing={setSub}
        onStale={workflow.reload}
      />
      <DeleteRequestDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        requestId={r.id}
        onDeleted={() => {
          invalidateRequestViews(client);
          closeRequestTabs(r.id);
        }}
        onStale={workflow.reload}
      />
      <CancelRequestDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        requestId={r.id}
        rowVersion={workflow.rowVersion}
        onCancelled={applied}
        onStale={workflow.reload}
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
