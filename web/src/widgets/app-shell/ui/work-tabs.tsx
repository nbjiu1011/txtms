"use client";

import { useState } from "react";
import { cn } from "@/shared/lib";
import { ADMIN_MENU, ROUTES, WORK_MENU, type RouteKey, type TabRef } from "@/shared/config/routes";
import { Icon, Tag } from "@/shared/ui";
import { Modal, Popover, PopoverBody, PopoverHeader, PopoverItem, PopoverSection } from "@/shared/common";
import type { WorkTab } from "../model/tab-model";
import { useRecentContents } from "../model/use-recent-contents";
import styles from "./work-tabs.module.css";

export interface WorkTabsProps {
  tabs: WorkTab[];
  activeId: string | null;
  visibleRoutes: ReadonlySet<RouteKey>;
  /** Current project: the popover lists the first contents of its visible requests. */
  projectId: number | null;
  onSelect: (tab: WorkTab) => void;
  /** Close without confirmation (the dirty check happens here). */
  onClose: (tab: WorkTab) => void;
  onOpen: (ref: TabRef) => void;
}

/** Visible title of a tab: request/content/customer/notice titles come from the view, menus from ROUTES. */
export function tabTitle(tab: WorkTab): string {
  if (tab.route === "request") return tab.title || tab.params.id || "요청";
  if (tab.route === "content") return tab.title || "콘텐츠";
  if (tab.route === "opsCustomer") return tab.title || "고객사";
  if (tab.route === "notice" || tab.route === "adminNotice") return tab.title || "공지";
  if (tab.route === "adminUser") return tab.title || "사용자";
  return ROUTES[tab.route].title;
}

/** `.tabs[role=tablist]` — open work tabs, dirty marker, close, and the `+` add popover. */
export function WorkTabs({ tabs, activeId, visibleRoutes, projectId, onSelect, onClose, onOpen }: WorkTabsProps) {
  const [addEl, setAddEl] = useState<HTMLButtonElement | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmTab, setConfirmTab] = useState<WorkTab | null>(null);
  const recentContents = useRecentContents(projectId, addOpen);
  const menus = [...WORK_MENU, ...ADMIN_MENU].filter((route) => visibleRoutes.has(route));

  const requestClose = (tab: WorkTab) => {
    if (tab.dirty) setConfirmTab(tab);
    else onClose(tab);
  };

  const openFromPopover = (ref: TabRef) => {
    setAddOpen(false);
    onOpen(ref);
  };

  return (
    <>
      {/* the tablist owns the tabs only; the `+` button sits next to it (a `display: contents` wrapper keeps
          the reference flex row) */}
      <nav className={styles.tabs} aria-label="업무 탭">
        <div className={styles.list} role="tablist" aria-label="열린 탭">
          {tabs.map((tab) => {
            const on = tab.id === activeId;
            const title = tabTitle(tab);
            return (
              <div key={tab.id} className={cn(styles.tab, on && styles.on)} title={title} onClick={() => onSelect(tab)}>
                <button
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={on}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={on ? 0 : -1}
                  className={styles.tabBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(tab);
                  }}
                >
                  {tab.dirty ? <span className={styles.dirty} title="저장하지 않은 변경" /> : null}
                  <span className={styles.t}>{title}</span>
                  {tab.dirty ? <span className="sr-only">(저장하지 않은 변경)</span> : null}
                </button>
                {tabs.length > 1 ? (
                  <button
                    type="button"
                    className={styles.x}
                    aria-label={`${title} 탭 닫기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      requestClose(tab);
                    }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          ref={setAddEl}
          type="button"
          className={styles.add}
          aria-label="새 탭 열기"
          title="새 탭 열기"
          aria-haspopup="dialog"
          aria-expanded={addOpen}
          onClick={() => setAddOpen((v) => !v)}
        >
          +
        </button>
      </nav>
      <Popover open={addOpen} anchor={addEl} onClose={() => setAddOpen(false)} label="새 탭으로 열기" width={320}>
        <PopoverHeader>
          <b>새 탭으로 열기</b>
        </PopoverHeader>
        <PopoverBody>
          <PopoverSection>메뉴</PopoverSection>
          {menus.map((route) => {
            const def = ROUTES[route];
            return (
              <PopoverItem key={route} onClick={() => openFromPopover({ route, params: {} })}>
                {def.icon ? <Icon name={def.icon} size={16} /> : null}
                {def.title}
              </PopoverItem>
            );
          })}
          <PopoverSection>콘텐츠</PopoverSection>
          {recentContents.map((c) => (
            <PopoverItem
              key={`${c.requestId}:${c.contentKey}`}
              onClick={() => openFromPopover({ route: "content", params: { id: c.requestId, key: c.contentKey } })}
            >
              <Tag variant="fill" className={styles.ctag}>
                {c.contentKey}
              </Tag>
              <span className={styles.ctitle}>{c.title}</span>
              <span className={styles.cid}>{c.requestId.slice(-3)}</span>
            </PopoverItem>
          ))}
        </PopoverBody>
      </Popover>
      <Modal
        open={confirmTab !== null}
        title="저장하지 않은 변경이 있습니다"
        description={confirmTab ? `"${tabTitle(confirmTab)}" 탭을 닫으면 저장하지 않은 수정 내용이 사라집니다.` : undefined}
        onClose={() => setConfirmTab(null)}
        okLabel="저장하지 않고 닫기"
        okVariant="warn"
        cancelLabel="계속 편집"
        onOk={() => {
          if (confirmTab) onClose(confirmTab);
        }}
      />
    </>
  );
}
