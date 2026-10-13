"use client";

import { Empty, ListItem, Panel } from "@/shared/ui";
import { Button, Modal } from "@/shared/common";
import { formatDate } from "@/shared/lib";
import { RequestStatusChip, useRequests, type RequestListParams } from "@/entities/request";
import styles from "./dashboard.module.css";

export interface RequestListModalProps {
  /** Modal title (KPI / pipeline stage label). */
  title: string;
  /** Server list query (same `view` / status as the tile). Null closes the modal. */
  params: RequestListParams | null;
  onClose: () => void;
  onOpenRequest: (id: string) => void;
}

/** Requests behind a KPI tile or pipeline stage (reference `reqList`). */
export function RequestListModal({ title, params, onClose, onOpenRequest }: RequestListModalProps) {
  const open = params !== null;
  const query = useRequests(params ?? {}, open);
  const rows = query.data?.content ?? [];
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {query.isPending ? (
        <Empty plain title="불러오는 중입니다" />
      ) : query.isError ? (
        <Empty
          plain
          title="목록을 불러오지 못했습니다"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Empty title="해당 요청이 없습니다" />
      ) : (
        <Panel className={styles.listPanel}>
          {rows.map((r) => (
            <ListItem
              key={r.id}
              leading={<RequestStatusChip status={r.status} />}
              title={r.title || "제목 없는 요청"}
              meta={`${r.id}  납기 ${formatDate(r.dueDate)}`}
              onClick={() => {
                onClose();
                onOpenRequest(r.id);
              }}
            />
          ))}
        </Panel>
      )}
    </Modal>
  );
}
