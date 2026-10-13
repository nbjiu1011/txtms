"use client";

import {
  Activity,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AUTH_PATHS,
  ROUTE_KEYS,
  ROUTES,
  pathToTab,
  tabToPath,
  type RouteKey,
  type TabRef,
} from "@/shared/config/routes";
import { toast } from "@/shared/ui";
import { ESCAPE_PRIORITY, useEscapeLayer } from "@/shared/lib";
import { canAccessRoute, useSessionStore, type AccessContext, type Me } from "@/entities/me";
import { MAX_TABS, TAB_LIMIT_MESSAGE, findTab, type WorkTab } from "../model/tab-model";
import { getActiveTab, hasDirtyTab, useTabStore } from "../model/tab-store";
import { useMenuCounts } from "../model/use-menu-counts";
import { useOpenNotifiedRequest } from "../model/use-open-notified-request";
import { useWorkContext } from "../model/use-work-context";
import type { WorkViewRegistry } from "../model/view-types";
import { Sidebar } from "./sidebar";
import { TabView } from "./tab-view";
import { TopBar } from "./top-bar";
import { WorkTabs } from "./work-tabs";
import styles from "./app-shell.module.css";

export interface AppShellProps {
  views: WorkViewRegistry;
}

/** Authenticated workspace: waits for the session, sends anonymous users to the login page. */
export function AppShell({ views }: AppShellProps) {
  const status = useSessionStore((s) => s.status);
  const me = useSessionStore((s) => s.me);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "anonymous") return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`${AUTH_PATHS.login}${next}`);
  }, [status, pathname, router]);

  if (!me) return <div className={styles.app} aria-busy="true" />;
  // Keyed by user: a persona switch remounts every tab view (no state leaks between users).
  return <Workspace key={me.id} me={me} views={views} />;
}

let openHomeOnNextMount = false;

function Workspace({ me, views }: { me: Me; views: WorkViewRegistry }) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);
  const activeId = useTabStore((s) => s.activeId);
  const context = useWorkContext(me);
  const [navOpen, setNavOpen] = useState(false);
  const sideRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const scrolls = useRef(new Map<string, number>());

  const access: AccessContext = useMemo(
    () => ({ me, customer: context.customer, projectId: context.projectId }),
    [me, context.customer, context.projectId],
  );
  const contextReady = context.customer !== null || context.customers.length === 0;

  const visibleRoutes = useMemo(() => {
    const set = new Set<RouteKey>();
    for (const key of ROUTE_KEYS) {
      const def = ROUTES[key];
      if (def.group && def.enabled && canAccessRoute(def.access, access)) set.add(key);
    }
    return set;
  }, [access]);

  // URL → tab: a direct address opens (or re-activates) its tab.
  useEffect(() => {
    const store = useTabStore.getState();
    store.hydrate(me.id);
    if (openHomeOnNextMount) {
      openHomeOnNextMount = false;
      store.open({ route: "home", params: {} });
      if (pathname !== "/") router.replace("/", { scroll: false });
      return;
    }
    const ref = pathToTab(pathname ?? "/");
    if (!ref) {
      router.replace("/", { scroll: false });
      return;
    }
    if (store.open(ref) === "limit") {
      toast(TAB_LIMIT_MESSAGE);
      const fallback = getActiveTab() ?? useTabStore.getState().tabs[0];
      if (fallback) {
        useTabStore.getState().activate(fallback.id);
        router.replace(tabToPath(fallback), { scroll: false });
      }
    }
  }, [pathname, me.id, router]);

  // Leaving the page with unsaved changes asks the browser's confirmation.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyTab()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Per-tab scroll position of the shared scroll container.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (main && activeId) main.scrollTop = scrolls.current.get(activeId) ?? 0;
  }, [activeId]);

  // Mobile navigation: Escape and outside click close it.
  useEscapeLayer(navOpen, ESCAPE_PRIORITY.nav, () => setNavOpen(false));
  useEffect(() => {
    if (!navOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || sideRef.current?.contains(target) || target.closest("[aria-controls='app-sidebar']")) return;
      setNavOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [navOpen]);

  const navigate = useCallback(
    (ref: TabRef) => {
      setNavOpen(false);
      const state = useTabStore.getState();
      if (!findTab(state, ref) && state.tabs.length >= MAX_TABS) {
        toast(TAB_LIMIT_MESSAGE);
        return;
      }
      router.push(tabToPath(ref), { scroll: false });
    },
    [router],
  );

  const selectTab = useCallback(
    (tab: WorkTab) => {
      setNavOpen(false);
      useTabStore.getState().activate(tab.id);
      router.push(tabToPath(tab), { scroll: false });
    },
    [router],
  );

  const closeTab = useCallback(
    (tab: WorkTab) => {
      const store = useTabStore.getState();
      const wasActive = store.activeId === tab.id;
      store.close(tab.id);
      scrolls.current.delete(tab.id);
      const next = getActiveTab();
      if (wasActive && next) router.replace(tabToPath(next), { scroll: false });
    },
    [router],
  );

  const goHome = useCallback(() => navigate({ route: "home", params: {} }), [navigate]);
  const counts = useMenuCounts(context.projectId, context.customerId, visibleRoutes);
  const openNotifiedRequest = useOpenNotifiedRequest(navigate);
  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  return (
    <div className={styles.app}>
      <Sidebar
        ref={sideRef}
        activeRoute={activeTab?.route ?? null}
        visibleRoutes={visibleRoutes}
        counts={counts}
        onNavigate={(route) => navigate({ route, params: {} })}
        open={navOpen}
      />
      <TopBar
        me={me}
        context={context}
        navOpen={navOpen}
        onToggleNav={() => setNavOpen((v) => !v)}
        onOpenProfile={() => navigate({ route: "profile", params: {} })}
        onOpenRequest={openNotifiedRequest}
        onPersonaSwitched={() => {
          openHomeOnNextMount = true;
        }}
      />
      <WorkTabs
        tabs={tabs}
        activeId={activeId}
        visibleRoutes={visibleRoutes}
        projectId={context.projectId}
        onSelect={selectTab}
        onClose={closeTab}
        onOpen={navigate}
      />
      <main
        ref={mainRef}
        id="main"
        className={styles.main}
        onScroll={(event) => {
          if (activeId) scrolls.current.set(activeId, event.currentTarget.scrollTop);
        }}
      >
        {tabs.map((tab) => (
          <Activity key={tab.id} mode={tab.id === activeId ? "visible" : "hidden"}>
            <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>
              <TabView
                tab={tab}
                active={tab.id === activeId}
                views={views}
                access={access}
                contextReady={contextReady}
                me={me}
                context={context}
                openTab={navigate}
                onGoHome={goHome}
              />
            </div>
          </Activity>
        ))}
      </main>
    </div>
  );
}
