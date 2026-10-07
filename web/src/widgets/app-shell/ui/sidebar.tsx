"use client";

import type { ReactNode, Ref } from "react";
import { ADMIN_MENU, OPS_MENU, ROUTES, WORK_MENU, type RouteKey } from "@/shared/config/routes";
import { BrandMark, Icon } from "@/shared/ui";
import styles from "./sidebar.module.css";

export interface SidebarProps {
  /** Route of the active tab (`.on` + aria-current). */
  activeRoute: RouteKey | null;
  /** Routes the current user can open in the current context (and that are implemented). */
  visibleRoutes: ReadonlySet<RouteKey>;
  /** Badge counts per menu (0/undefined hides the badge). */
  counts?: Partial<Record<RouteKey, number>>;
  onNavigate: (route: RouteKey) => void;
  /** Mobile (≤860px) off-canvas state. */
  open: boolean;
  ref?: Ref<HTMLElement>;
}

const GROUPS: { title: string; routes: readonly RouteKey[]; alwaysShowTitle: boolean }[] = [
  { title: "업무", routes: WORK_MENU, alwaysShowTitle: true },
  { title: "고객사 관리", routes: ADMIN_MENU, alwaysShowTitle: false },
  { title: "운영 관리", routes: OPS_MENU, alwaysShowTitle: false },
];

/** `aside.side` — brand and grouped menu (업무 / 고객사 관리 / 운영 관리). */
export function Sidebar({ activeRoute, visibleRoutes, counts, onNavigate, open, ref }: SidebarProps) {
  return (
    <aside ref={ref} className={styles.side} data-open={open} id="app-sidebar">
      <div className={styles.brand}>
        <BrandMark />
        <b>TMS</b>
      </div>
      <nav className={styles.nav} aria-label="주 메뉴">
        {GROUPS.map((group) => {
          const items = group.routes.filter((route) => visibleRoutes.has(route));
          if (items.length === 0 && !group.alwaysShowTitle) return null;
          return (
            <MenuGroup key={group.title} title={group.title}>
              {items.map((route) => {
                const def = ROUTES[route];
                const count = counts?.[route];
                const on = activeRoute === route;
                return (
                  <button
                    key={route}
                    type="button"
                    className={on ? styles.on : undefined}
                    aria-current={on ? "page" : undefined}
                    onClick={() => onNavigate(route)}
                  >
                    {def.icon ? <Icon name={def.icon} /> : null}
                    <span>{def.title}</span>
                    {count ? <span className={styles.cnt}>{count}</span> : null}
                  </button>
                );
              })}
            </MenuGroup>
          );
        })}
      </nav>
    </aside>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h6>{title}</h6>
      {children}
    </>
  );
}
