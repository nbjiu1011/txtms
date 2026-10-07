import type { ComponentType } from "react";
import type { RouteKey, TabRef } from "@/shared/config/routes";
import type { Me } from "@/entities/me";
import type { WorkTab } from "./tab-model";
import type { WorkContext } from "./use-work-context";

/** Props every work-tab view receives. Views stay mounted while their tab is open. */
export interface WorkViewProps {
  tab: WorkTab;
  /** The tab is the visible one. */
  active: boolean;
  me: Me;
  /** Selected customer/project (top bar) with the loaded customer and project lists. */
  context: WorkContext;
  setDirty: (dirty: boolean) => void;
  setTitle: (title: string | null) => void;
  /** Opens (or re-activates) a work tab; respects the tab limit. */
  openTab: (ref: TabRef) => void;
}

export type WorkViewRegistry = Partial<Record<RouteKey, ComponentType<WorkViewProps>>>;
