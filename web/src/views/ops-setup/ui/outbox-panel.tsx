"use client";

import { useState } from "react";
import { LIST_PAGE_SIZE, formatDateTime, useListPage } from "@/shared/lib";
import { Empty, KeyValueList, Panel, PanelHeader, ReadOnlyBox, Tag } from "@/shared/ui";
import { Button, DataTable, Modal, type DataTableColumn } from "@/shared/common";
import { OUTBOX_KIND_LABEL, OUTBOX_STATUS_LABEL, type OutboxMail } from "@/entities/audit";
import { useOpsOutbox, type OpsCustomer } from "@/entities/ops";
import styles from "./ops-setup.module.css";

const kindLabel = (m: OutboxMail) => OUTBOX_KIND_LABEL[m.kind] ?? m.kind;
const statusLabel = (m: OutboxMail) => OUTBOX_STATUS_LABEL[m.status] ?? m.status;
const whenOf = (m: OutboxMail) => formatDateTime(m.sentAt ?? m.createdAt);

/**
 * 메일 발송 대기함 of the selected customer's users (operator, `GET /api/ops/outbox?customerId=`):
 * invitation, reset and reminder mails, newest first, 20 per page. The row action 보기 shows the body.
 * Token links are masked outside demo mode — only the recipient can use them.
 */
export function OpsOutboxPanel({ customer }: { customer: Pick<OpsCustomer, "id" | "name"> }) {
  // the page belongs to one customer: a new customer starts on its first page
  const [page, setPage] = useListPage(String(customer.id));
  const outbox = useOpsOutbox(customer.id, page, LIST_PAGE_SIZE);
  const [viewing, setViewing] = useState<OutboxMail | null>(null);

  const columns: DataTableColumn<OutboxMail>[] = [
    { id: "kind", name: "종류", width: "120px", cell: kindLabel },
    { id: "to", name: "받는 사람", width: "220px", wrap: true, cell: (m) => m.to },
    {
      id: "subject",
      name: "제목",
      grow: 1,
      minWidth: "200px",
      wrap: true,
      cell: (m) => (
        <span>
          {m.subject}
          {m.masked ? (
            <Tag variant="fill" className={styles.masked}>
              링크 가림
            </Tag>
          ) : null}
        </span>
      ),
    },
    { id: "status", name: "상태", width: "100px", cell: statusLabel },
    { id: "at", name: "시각", width: "150px", cell: (m) => <span className={styles.when}>{whenOf(m)}</span> },
    {
      id: "view",
      name: <span className={styles.sr}>본문</span>,
      width: "76px",
      rowAction: true,
      cell: (m) => (
        <Button size="sm" aria-label={`${m.to} ${m.subject} 보기`} onClick={() => setViewing(m)}>
          보기
        </Button>
      ),
    },
  ];

  return (
    <Panel className={styles.block} aria-label="메일 발송 대기함" aria-busy={outbox.isFetching}>
      <PanelHeader
        title={`메일 발송 대기함 · ${customer.name}`}
        note="실제 메일 발송 연동 전입니다. 초대·재설정 링크는 데모 모드에서만 보입니다"
      />
      {outbox.isError ? (
        <Empty
          title="발송 대기함을 불러오지 못했습니다"
          description={outbox.error.message}
          action={<Button onClick={() => void outbox.refetch()}>다시 시도</Button>}
        />
      ) : (
        <DataTable
          label="메일 발송 대기함"
          columns={columns}
          data={outbox.data?.content ?? []}
          loading={outbox.isPending}
          page={
            outbox.data ? { number: page, size: outbox.data.page.size, totalElements: outbox.data.page.totalElements } : undefined
          }
          onPage={setPage}
          empty={<Empty plain title="발송 대기 메일이 없습니다" description="사용자를 초대하면 초대 메일이 여기에 쌓입니다." />}
        />
      )}
      <MailDialog mail={viewing} onClose={() => setViewing(null)} />
    </Panel>
  );
}

/** One outbox mail with its body (read only). */
function MailDialog({ mail, onClose }: { mail: OutboxMail | null; onClose: () => void }) {
  if (!mail) return null;
  return (
    <Modal open onClose={onClose} title={mail.subject} cancelLabel="닫기">
      <KeyValueList
        items={[
          { label: "받는 사람", value: mail.to },
          { label: "종류", value: kindLabel(mail) },
          {
            label: "상태",
            value: (
              <>
                {statusLabel(mail)} · {whenOf(mail)}
                {mail.masked ? (
                  <Tag variant="fill" className={styles.masked}>
                    링크 가림
                  </Tag>
                ) : null}
              </>
            ),
          },
        ]}
      />
      <ReadOnlyBox className={styles.mailBody}>{mail.body}</ReadOnlyBox>
    </Modal>
  );
}
