"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Empty, Panel, PanelHeader, Tag } from "@/shared/ui";
import { Button, DataTable, Modal, RowLink, type DataTableColumn } from "@/shared/common";
import { OUTBOX_KIND_LABEL, OUTBOX_STATUS_LABEL, useCustomerOutbox, type OutboxMail } from "@/entities/audit";

import styles from "./admin-users.module.css";

const PAGE_SIZE = 20;

const kindOf = (m: OutboxMail) => OUTBOX_KIND_LABEL[m.kind] ?? m.kind;
const statusOf = (m: OutboxMail) => OUTBOX_STATUS_LABEL[m.status] ?? m.status;
const timeOf = (m: OutboxMail) => formatDateTime(m.sentAt ?? m.createdAt);

/**
 * 메일 발송 대기함 (reference J:146, below the users page): invitation, reset and reminder mails of the
 * customer's users. A row opens the mail body. Token links come masked unless the server shows them (demo sample
 * customer).
 */
export function OutboxPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<OutboxMail | null>(null);
  const outbox = useCustomerOutbox(customerId, page, PAGE_SIZE);
  const columns: DataTableColumn<OutboxMail>[] = [
    { id: "kind", name: "종류", width: "96px", cell: kindOf },
    { id: "to", name: "받는 사람", width: "220px", wrap: true, cell: (m) => m.to },
    {
      id: "subject",
      name: "제목",
      grow: 1,
      minWidth: "220px",
      rowAction: true,
      cell: (m) => (
        <span>
          <RowLink onClick={() => setOpen(m)} label={`${m.subject} · ${m.to} 메일 보기`}>
            {m.subject}
          </RowLink>
          {m.masked ? (
            <Tag variant="fill" className={styles.masked}>
              링크 가림
            </Tag>
          ) : null}
        </span>
      ),
    },
    { id: "status", name: "상태", width: "96px", cell: statusOf },
    { id: "at", name: "시각", width: "128px", cell: (m) => <span className={styles.when}>{timeOf(m)}</span> },
  ];
  return (
    <Panel aria-label="메일 발송 대기함" aria-busy={outbox.isFetching}>
      <PanelHeader title="메일 발송 대기함" note="실제 메일 발송 연동 전입니다. 메일을 누르면 본문이 보입니다" />
      {outbox.isError ? (
        <Empty
          title="발송 대기함을 불러오지 못했습니다"
          description={outbox.error.message}
          action={<Button onClick={() => void outbox.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="발송 대기 메일"
          columns={columns}
          data={outbox.data?.content ?? []}
          onRowClick={setOpen}
          loading={outbox.isPending}
          page={
            outbox.data
              ? { number: page, size: outbox.data.page.size, totalElements: outbox.data.page.totalElements }
              : undefined
          }
          onPage={setPage}
          empty={<Empty title="발송 대기 메일이 없습니다" description="사용자를 초대하면 초대 메일이 여기에 쌓입니다." />}
        />
      )}
      {open ? (
        <Modal
          open
          onClose={() => setOpen(null)}
          title={open.subject}
          description={`${open.to} · ${kindOf(open)} · ${statusOf(open)} · ${timeOf(open)}`}
          cancelLabel="닫기"
        >
          {open.masked ? (
            <Tag variant="fill" className={styles.maskedTop}>
              링크 가림
            </Tag>
          ) : null}
          <p className={styles.mailBody}>{open.body}</p>
        </Modal>
      ) : null}
    </Panel>
  );
}
