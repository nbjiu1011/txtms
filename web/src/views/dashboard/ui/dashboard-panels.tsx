import { formatDate } from "@/shared/lib";
import { Avatar, Bar, Empty, ListItem, Panel, PanelBody, PanelHeader, StatusChip, Tag } from "@/shared/ui";
import { Button } from "@/shared/common";
import type { DashboardTodo, WorkloadRow } from "@/entities/dashboard";
import { noticePostedAt, noticeScopeText, type NoticeSummary } from "@/entities/notice";
import type { Project } from "@/entities/project";
import {
  CONTENT_TYPE_LABEL,
  ContentTypeChip,
  REQUEST_STATUS_TONE,
  RequestStatusChip,
  type RequestSummary,
} from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./dashboard.module.css";

/** Rows the "지금 처리할 일" panel shows (the count note shows all). */
export const TODO_VISIBLE = 8;

function dueTag(item: { overdue: boolean; dueSoon: boolean }) {
  if (item.overdue) return <Tag variant="hot">지연</Tag>;
  if (item.dueSoon) return <Tag variant="hot">납기 임박</Tag>;
  return null;
}

export function TodoPanel({ todos, onOpen }: { todos: DashboardTodo[]; onOpen: (id: string) => void }) {
  return (
    <Panel>
      <PanelHeader title="지금 처리할 일" note={`${todos.length}건`} />
      {todos.length === 0 ? (
        <Empty title="처리할 일이 없습니다" description="새 업무가 생기면 알림으로 알려드립니다." />
      ) : (
        todos.slice(0, TODO_VISIBLE).map((t) => (
          <ListItem
            key={`${t.requestId}:${t.action}`}
            leading={
              <>
                <ContentTypeChip type={t.type} />
                <StatusChip tone={REQUEST_STATUS_TONE[t.tone]} className={styles.autoChip}>
                  {t.label}
                </StatusChip>
              </>
            }
            title={t.title || "제목 없는 요청"}
            meta={`${t.requestId}  ${t.projectName}  납기 ${formatDate(t.dueDate)}`}
            trailing={dueTag(t)}
            onClick={() => onOpen(t.requestId)}
          />
        ))
      )}
    </Panel>
  );
}

export function RecentPanel({
  recent,
  users,
  onOpen,
  onShowAll,
}: {
  recent: RequestSummary[];
  users: UserDirectory;
  onOpen: (id: string) => void;
  onShowAll: () => void;
}) {
  return (
    <Panel>
      <PanelHeader title="프로젝트 최근 요청">
        <Button size="sm" variant="ghost" className={styles.headBtn} onClick={onShowAll}>
          전체 보기
        </Button>
      </PanelHeader>
      {recent.length === 0 ? (
        <Empty title="볼 수 있는 요청이 없습니다" />
      ) : (
        recent.map((r) => (
          <ListItem
            key={r.id}
            leading={
              <>
                <ContentTypeChip type={r.type} />
                <RequestStatusChip status={r.status} />
              </>
            }
            title={r.title || "제목 없는 요청"}
            meta={`${r.id}  ${CONTENT_TYPE_LABEL[r.type]}  ${users.name(r.requesterId)}`}
            trailing={<span className={styles.dueText}>{formatDate(r.dueDate)}</span>}
            onClick={() => onOpen(r.id)}
          />
        ))
      )}
    </Panel>
  );
}

export function WorkloadPanel({ rows, users }: { rows: WorkloadRow[]; users: UserDirectory }) {
  const max = Math.max(1, ...rows.map((r) => r.active));
  return (
    <Panel>
      <PanelHeader title="검수자별 업무량" note="검수 중, 확인 요청, 승인 대기 기준" />
      <PanelBody>
        {rows.length === 0 ? (
          <span className={styles.muted}>검수자가 없습니다</span>
        ) : (
          rows.map((row) => {
            const user = users.get(row.userId);
            const name = user?.name ?? "-";
            return (
              <div key={row.userId} className={styles.wl}>
                <Avatar name={name} color={user?.avatarColor} size={24} />
                <span className={styles.wlName}>{name}</span>
                <Bar className={styles.wlBar} percent={(row.active / max) * 100} label={`${name} 업무량`} />
                <span className={styles.wlN}>{row.active}건</span>
              </div>
            );
          })
        )}
      </PanelBody>
    </Panel>
  );
}

export function NoticePanel({
  notices,
  projects,
  onShowAll,
  onOpen,
}: {
  notices: NoticeSummary[];
  projects: Project[];
  /** Opens the notices screen. */
  onShowAll: () => void;
  /** Opens the notices screen with this notice expanded. */
  onOpen: (id: number) => void;
}) {
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name;
  return (
    <Panel>
      <PanelHeader title="공지">
        <Button size="sm" variant="ghost" className={styles.headBtn} onClick={onShowAll}>
          전체
        </Button>
      </PanelHeader>
      {notices.length === 0 ? (
        <Empty title="공지가 없습니다" />
      ) : (
        notices
          .slice(0, 4)
          .map((n) => (
            <ListItem
              key={n.id}
              title={n.title}
              meta={`${noticeScopeText(n, projectName)}  ${formatDate(noticePostedAt(n))}`}
              onClick={() => onOpen(n.id)}
            />
          ))
      )}
    </Panel>
  );
}
