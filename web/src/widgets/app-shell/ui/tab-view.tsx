"use client";

import { useCallback } from "react";
import { ROUTES, type TabRef } from "@/shared/config/routes";
import { canAccessRoute, type AccessContext, type Me } from "@/entities/me";
import type { WorkTab } from "../model/tab-model";
import { useTabStore } from "../model/tab-store";
import type { WorkContext } from "../model/use-work-context";
import type { WorkViewRegistry } from "../model/view-types";
import { AccessDenied } from "./access-denied";

export interface TabViewProps {
  tab: WorkTab;
  active: boolean;
  views: WorkViewRegistry;
  access: AccessContext;
  contextReady: boolean;
  me: Me;
  context: WorkContext;
  openTab: (ref: TabRef) => void;
  onGoHome: () => void;
}

/** Resolves the view of one tab: access check, unavailable screens, then the registered view. */
export function TabView({ tab, active, views, access, contextReady, me, context, openTab, onGoHome }: TabViewProps) {
  const setDirty = useCallback((dirty: boolean) => useTabStore.getState().setDirty(tab.id, dirty), [tab.id]);
  const setTitle = useCallback((title: string | null) => useTabStore.getState().setTitle(tab.id, title), [tab.id]);
  const def = ROUTES[tab.route];

  // operator screens keep their own customer selection and do not wait for the top bar context
  if (def.access !== "always" && def.access !== "ops" && !contextReady) return null;
  if (!canAccessRoute(def.access, access)) {
    return (
      <AccessDenied
        title="이 메뉴를 사용할 권한이 없습니다"
        description={`${def.title} 메뉴는 현재 역할과 프로젝트 권한으로 열 수 없습니다.`}
        onGoHome={onGoHome}
      />
    );
  }
  const View = def.enabled ? views[tab.route] : undefined;
  if (!View) {
    return (
      <AccessDenied
        hideNote
        title="아직 제공되지 않는 화면입니다"
        description={`${def.title} 화면은 준비 중입니다.`}
        onGoHome={onGoHome}
      />
    );
  }
  return (
    <View
      tab={tab}
      active={active}
      me={me}
      context={context}
      setDirty={setDirty}
      setTitle={setTitle}
      openTab={openTab}
    />
  );
}
