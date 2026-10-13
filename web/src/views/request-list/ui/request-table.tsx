import { formatDate } from "@/shared/lib";
import { Avatar, AvatarStack, Icon, Table, Tag, tableClasses } from "@/shared/ui";
import { Button } from "@/shared/common";
import { ContentTypeChip, RequestStatusChip, type RequestSummary } from "@/entities/request";
import type { UserDirectory } from "@/entities/user";
import styles from "./request-list.module.css";

export interface RequestTableProps {
  rows: RequestSummary[];
  users: UserDirectory;
  onOpen: (id: string) => void;
}

const COLUMNS = ["요청 ID", "제목", "유형", "상태", "차수", "요청자", "주담당 / 배정 검수자", "확정 납기", "접수일", ""];

/** Request table of the list screen (reference `vRequests` table). */
export function RequestTable({ rows, users, onOpen }: RequestTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          {COLUMNS.map((c, i) => (
            <th key={i}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const requester = users.get(r.requesterId);
          const assigned =
            r.primaryReviewerId === null
              ? []
              : [r.primaryReviewerId, ...r.reviewerIds.filter((id) => id !== r.primaryReviewerId)];
          return (
            <tr key={r.id} className={tableClasses.click} onClick={() => onOpen(r.id)}>
              <td className={tableClasses.id}>{r.id}</td>
              <td className={tableClasses.ttl}>
                {r.title || "제목 없는 요청"}
                {r.recallRequested ? (
                  <>
                    {" "}
                    <Tag variant="recall">회수 요청됨</Tag>
                  </>
                ) : null}
                {r.parentRequestId ? (
                  <>
                    {" "}
                    <Tag>후속</Tag>
                  </>
                ) : null}
              </td>
              <td>
                <ContentTypeChip type={r.type} showLabel />
              </td>
              <td>
                <RequestStatusChip status={r.status} />
              </td>
              <td>{r.round}차</td>
              <td>
                <span className={styles.person}>
                  <Avatar name={requester?.name ?? "-"} color={requester?.avatarColor} size={22} />
                  {requester?.name ?? "-"}
                </span>
              </td>
              <td>
                {r.primaryReviewerId === null ? (
                  <span className={styles.faint}>미배정</span>
                ) : (
                  <span className={styles.person}>
                    <AvatarStack
                      people={assigned.map((id) => ({ name: users.name(id), color: users.get(id)?.avatarColor }))}
                    />
                    <b className={styles.primaryName}>{users.name(r.primaryReviewerId)}</b>
                  </span>
                )}
              </td>
              <td>
                {formatDate(r.dueDate)} {r.urgency === "URGENT" ? <Tag variant="hot">긴급</Tag> : null}{" "}
                {r.overdue ? <Tag variant="hot">지연</Tag> : null}
              </td>
              <td>{formatDate(r.submittedAt)}</td>
              <td>
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.newTab}
                  title="새 탭으로 열기"
                  aria-label={`${r.id} 새 탭으로 열기`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(r.id);
                  }}
                >
                  <Icon name="ext" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
