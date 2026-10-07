import Link from "next/link";
import type { CSSProperties } from "react";
import { formatDate, formatDateTime } from "@/shared/lib";
import { Avatar, AvatarStack, Button, Icon, ProgressTrack, RoundBadge, SubTabs, Tag, type SubTabItem } from "@/shared/ui";
import {
  CONTENT_TYPE_LABEL,
  ContentTypeChip,
  FINAL_STATUSES,
  REQUEST_STATUS_TONE,
  RequestStatusChip,
  STATUS_TONE_COLOR,
  buildTrack,
  type RequestAction,
  type RequestDetail,
} from "@/entities/request";
import type { RequestPage } from "../model/use-request-page";
import { headerButtons } from "../model/header-actions";
import styles from "./header.module.css";

export type DetailSub = "contents" | "info" | "hist" | "result";

export interface RequestHeaderProps {
  page: RequestPage;
  /** Title as edited locally (draft autosave). */
  title?: string;
  approvalEnabled: boolean;
  sub: DetailSub;
  onSub: (sub: DetailSub) => void;
  performable: ReadonlySet<RequestAction>;
  onAction: (action: RequestAction) => void;
  onOpenRequest: (id: string) => void;
  onOpenList: () => void;
}

export function statusColorStyle(request: Pick<RequestDetail, "status">): CSSProperties {
  return { "--c": STATUS_TONE_COLOR[REQUEST_STATUS_TONE[request.status]] } as CSSProperties;
}

/** `.req-head` — breadcrumb, title row with actions, meta, status track and sub tabs. */
export function RequestHeader(props: RequestHeaderProps) {
  const { page, title, approvalEnabled, sub, onSub, performable, onAction, onOpenRequest, onOpenList } = props;
  const { request: r, users, project, customer } = page;
  const buttons = headerButtons(performable);
  const requester = users.get(r.requesterId);
  const tabs: SubTabItem<DetailSub>[] = [
    { key: "contents", label: "콘텐츠", count: r.contents.length },
    { key: "info", label: "요청 정보" },
    { key: "hist", label: "히스토리", count: r.historyCount },
    ...(FINAL_STATUSES.includes(r.status) ? [{ key: "result" as const, label: "완료 결과" }] : []),
  ];
  const track = buildTrack({
    status: r.status,
    approvalEnabled,
    stageTimes: r.stageTimes,
    askCount: r.asks.length,
  });

  return (
    <div className={styles.reqHead} style={statusColorStyle(r)}>
      <div className={styles.crumb}>
        <Link
          href="/requests"
          scroll={false}
          onNavigate={(e) => {
            e.preventDefault();
            onOpenList();
          }}
        >
          {customer?.name ?? ""} / {project?.name ?? ""}
        </Link>{" "}
        / {r.id}
        {r.parent ? (
          <>
            {" "}
            <Link
              href={`/requests/${encodeURIComponent(r.parent.requestId)}`}
              scroll={false}
              onNavigate={(e) => {
                e.preventDefault();
                onOpenRequest(r.parent!.requestId);
              }}
            >
              원본 {r.parent.requestId}
            </Link>
          </>
        ) : null}
      </div>
      <div className={styles.reqTitle}>
        <ContentTypeChip type={r.type} size="lg" />
        <h1>{(title ?? r.title) || "제목 없는 요청"}</h1>
        <RequestStatusChip status={r.status} />
        <RoundBadge title="검수 차수">{r.round}차</RoundBadge>
        {r.recallRequested ? <Tag variant="recall">회수 요청됨</Tag> : null}
        {r.urgency === "URGENT" ? <Tag variant="hot">긴급</Tag> : null}
        <div className={styles.sp} />
        <div className={styles.acts}>
          {buttons.map((b) => (
            <Button key={b.action} variant={b.variant} onClick={() => onAction(b.action)}>
              {b.action === "CLONE" ? <Icon name="copy" /> : null}
              {b.label}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.reqMeta}>
        <span>
          유형<b>{CONTENT_TYPE_LABEL[r.type]}</b>
        </span>
        <span>
          요청자
          <b className={styles.metaPerson}>
            <Avatar name={requester?.name ?? "-"} color={requester?.avatarColor} size={20} />
            {requester?.name ?? "-"}
          </b>
        </span>
        <span>
          대표 검수자<b>{users.name(r.leadUserId ?? project?.leadUserId)}</b>
        </span>
        <span>
          주담당<b>{r.primaryReviewerId === null ? "미지정" : users.name(r.primaryReviewerId)}</b>
        </span>
        <span>
          배정 검수자
          <b>
            {r.reviewerIds.length ? (
              <>
                <AvatarStack
                  people={r.reviewerIds.map((id) => ({ name: users.name(id), color: users.get(id)?.avatarColor }))}
                />{" "}
                {r.reviewerIds.map((id) => users.name(id)).join(", ")}
              </>
            ) : (
              "-"
            )}
          </b>
        </span>
        <span>
          희망 납기<b>{formatDate(r.hopeDueDate)}</b>
        </span>
        <span>
          확정 납기
          <b>
            {formatDate(r.dueDate)}
            {r.overdue ? " (지연)" : ""}
          </b>
        </span>
        {r.submittedAt ? (
          <span>
            접수<b>{formatDateTime(r.submittedAt)}</b>
          </span>
        ) : null}
      </div>
      <ProgressTrack
        label="요청 진행 단계"
        steps={track.map((s) => ({
          key: s.stage,
          label: s.label,
          state: s.state,
          color: STATUS_TONE_COLOR[s.tone],
          loop: s.loop,
          date: s.reachedAt ? formatDateTime(s.reachedAt) : "",
        }))}
      />
      <SubTabs className={styles.subtabs} label="요청 상세" items={tabs} value={sub} onChange={onSub} />
    </div>
  );
}
