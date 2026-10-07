"use client";

import { formatDateTime } from "@/shared/lib";
import { Avatar, ReadOnlyBox, Tag } from "@/shared/ui";
import { ContentMockup, type Content, type Opinion } from "@/entities/request";
import type { RequestPage } from "../model/use-request-page";
import styles from "./work.module.css";

export type SidePanelTab = "proof" | "mock" | "op" | "ask";

export interface SidePanelProps {
  page: RequestPage;
  content: Content;
  meId: number;
  tab: SidePanelTab;
  onTab: (tab: SidePanelTab) => void;
}

/** `.side-panel` — 교정 / 미리보기 / 의견 / 확인 요청 (reference `vSidePanel`). */
export function SidePanel({ page, content, meId, tab, onTab }: SidePanelProps) {
  const r = page.request;
  const tabs: { key: SidePanelTab; label: string }[] = [
    { key: "proof", label: "교정" },
    { key: "mock", label: "미리보기" },
    { key: "op", label: `의견 ${r.opinions.length || ""}`.trimEnd() },
    { key: "ask", label: `확인 요청 ${r.asks.length || ""}`.trimEnd() },
  ];
  return (
    <aside className={styles.sidePanel} aria-label="콘텐츠 보조 패널">
      <div className={styles.spTabs} role="tablist" aria-label="보조 패널">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? styles.on : undefined}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.spBody} role="tabpanel">
        {tab === "proof" ? <ProofPanel page={page} content={content} /> : null}
        {tab === "mock" ? <MockPanel page={page} content={content} /> : null}
        {tab === "op" ? <OpinionsPanel page={page} meId={meId} /> : null}
        {tab === "ask" ? <AsksPanel page={page} /> : null}
      </div>
    </aside>
  );
}

/** Correction frame. The engine, check buttons and result cards arrive with M4. */
function ProofPanel({ page, content }: { page: RequestPage; content: Content }) {
  if (page.request.type === "FREEFORM" && content.files.length > 0) {
    return (
      <ReadOnlyBox className={styles.small}>
        첨부파일이 있는 자유입력형은 교정 실행·결과가 비활성화되며 전체 검사에서 제외됩니다. 첨부파일을 모두 제거하면
        다시 사용할 수 있습니다.
      </ReadOnlyBox>
    );
  }
  return <div className={styles.proofEmpty}>아직 검사하지 않았습니다.</div>;
}

function MockPanel({ page, content }: { page: RequestPage; content: Content }) {
  const r = page.request;
  const payload = content.payload;
  const templateCode = "templateCode" in payload ? payload.templateCode : null;
  return (
    <ContentMockup
      type={r.type}
      payload={payload}
      mockEnabled={page.mockEnabled}
      customerName={page.customer?.name ?? ""}
      templateName={page.project?.templates.find((t) => t.code === templateCode)?.name ?? null}
      values={page.variableValues}
    />
  );
}

function contentLabel(page: RequestPage, key: string | null): string {
  if (!key) return "요청 전체";
  const title = page.request.contents.find((c) => c.key === key)?.title ?? "";
  return `${key} ${title}`.trimEnd();
}

function OpinionsPanel({ page, meId }: { page: RequestPage; meId: number }) {
  const r = page.request;
  const groups = new Map<number, Opinion[]>();
  for (const o of r.opinions) groups.set(o.authorId, [...(groups.get(o.authorId) ?? []), o]);
  return (
    <>
      {groups.size === 0 ? (
        <p className={styles.emptyNote}>등록된 검수 의견이 없습니다.</p>
      ) : (
        [...groups.entries()].map(([authorId, opinions]) => {
          const author = page.users.get(authorId);
          return (
            <div key={authorId} className={styles.group}>
              <div className={styles.who}>
                <Avatar name={author?.name ?? "-"} color={author?.avatarColor} size={20} />
                <b>{author?.name ?? "-"}</b>
                {r.primaryReviewerId === authorId ? <Tag>주담당</Tag> : null}
              </div>
              {opinions.map((o) => (
                <div key={o.id} className={styles.qa}>
                  <div className={styles.faintSmall}>
                    {contentLabel(page, o.contentKey)} {formatDateTime(o.createdAt)}
                  </div>
                  <div className={styles.q}>{o.body}</div>
                </div>
              ))}
            </div>
          );
        })
      )}
      {r.status !== "IN_REVIEW" && r.reviewerIds.includes(meId) ? (
        <p className={styles.faintSmall}>검수 의견은 검수 중일 때만 등록할 수 있습니다.</p>
      ) : null}
    </>
  );
}

function AsksPanel({ page }: { page: RequestPage }) {
  const r = page.request;
  return (
    <>
      {r.asks.length === 0 ? (
        <p className={styles.emptyNote}>확인 요청 내역이 없습니다.</p>
      ) : (
        r.asks.map((a) => {
          const asker = page.users.get(a.askedBy);
          const answerer = page.users.get(a.answeredBy);
          return (
            <div key={a.id} className={styles.qa}>
              <div className={styles.who}>
                <Avatar name={asker?.name ?? "-"} color={asker?.avatarColor} size={20} />
                {asker?.name ?? "-"} {formatDateTime(a.askedAt)} <Tag>{a.contentKey || "요청 전체"}</Tag>
              </div>
              <div className={styles.q}>{a.question}</div>
              {a.answer !== null ? (
                <div className={styles.a}>
                  <div className={styles.who}>
                    <Avatar name={answerer?.name ?? "-"} color={answerer?.avatarColor} size={20} />
                    {answerer?.name ?? "-"} {formatDateTime(a.answeredAt)}
                  </div>
                  {a.answer}
                </div>
              ) : (
                <div className={styles.a}>답변 대기 중</div>
              )}
            </div>
          );
        })
      )}
      {r.allowedActions.includes("REVIEW") && r.recallRequested ? (
        <p className={`${styles.faintSmall} ${styles.askNote}`}>
          회수 요청이 처리될 때까지 확인 요청을 보낼 수 없습니다.
        </p>
      ) : null}
    </>
  );
}
