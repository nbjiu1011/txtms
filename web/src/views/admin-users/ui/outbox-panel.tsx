"use client";

import { useState } from "react";
import { formatDateTime } from "@/shared/lib";
import { Button, Pager, Panel, PanelBody, PanelHeader, Tag } from "@/shared/ui";
import { OUTBOX_STATUS_LABEL, useCustomerOutbox } from "@/entities/audit";

import styles from "./admin-users.module.css";

const PAGE_SIZE = 20;

/**
 * 메일 발송 대기함 (reference J:146, below the users page): invitation, reset and reminder mails of the
 * customer's users. Token links come masked unless the server shows them (demo sample customer).
 */
export function OutboxPanel({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(0);
  const outbox = useCustomerOutbox(customerId, page, PAGE_SIZE);
  const mails = outbox.data?.content ?? [];
  return (
    <Panel aria-label="메일 발송 대기함" aria-busy={outbox.isFetching}>
      <PanelHeader title="메일 발송 대기함" note="실제 메일 발송 연동 전입니다" />
      {outbox.isPending ? (
        <PanelBody>불러오는 중입니다</PanelBody>
      ) : outbox.isError ? (
        <PanelBody>
          발송 대기함을 불러오지 못했습니다{" "}
          <Button size="sm" onClick={() => void outbox.refetch()}>
            다시 시도
          </Button>
        </PanelBody>
      ) : mails.length === 0 ? (
        <PanelBody>발송 대기 메일이 없습니다.</PanelBody>
      ) : (
        mails.map((m) => (
          <PanelBody key={m.id} className={styles.mail}>
            <b>
              {m.subject} · {m.to}
            </b>
            <p className={styles.mailBody}>{m.body}</p>
            <span className={styles.mailMeta}>
              {OUTBOX_STATUS_LABEL[m.status] ?? m.status} · {formatDateTime(m.createdAt)}
              {m.masked ? (
                <Tag variant="fill" className={styles.masked}>
                  링크 가림
                </Tag>
              ) : null}
            </span>
          </PanelBody>
        ))
      )}
      <Pager page={page} totalPages={outbox.data?.page.totalPages ?? 0} onPage={setPage} />
    </Panel>
  );
}
