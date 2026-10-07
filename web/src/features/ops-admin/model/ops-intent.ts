import { isRouteKey, type RouteKey, type TabRef } from "@/shared/config/routes";
import { useViewIntent } from "@/shared/lib";
import { useWorkContextStore } from "@/entities/me";
import type { OpsTodo } from "@/entities/ops";

/** Operator screens that accept a hand-off (the view-intent key is the route key). */
export type OpsIntentView = Extract<RouteKey, "opsCustomers" | "opsSetup" | "opsStandards">;

/** What the receiving screen should select: a customer and/or a sub tab. */
export interface OpsIntent {
  customerId?: number;
  sub?: string;
}

export function encodeOpsIntent(intent: OpsIntent): string {
  return JSON.stringify(intent);
}

export function decodeOpsIntent(payload: string | undefined | null): OpsIntent | null {
  if (!payload) return null;
  try {
    const value = JSON.parse(payload) as unknown;
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    return {
      customerId: typeof v.customerId === "number" ? v.customerId : undefined,
      sub: typeof v.sub === "string" ? v.sub : undefined,
    };
  } catch {
    return null;
  }
}

/** Pending hand-off of an operator screen (stays until the screen consumes it on a user choice). */
export function useOpsIntent(view: OpsIntentView): OpsIntent | null {
  const payload = useViewIntent((s) => s.intents[view]);
  return decodeOpsIntent(payload);
}

/** Drops the pending hand-off once the user picks something on the screen. */
export function consumeOpsIntent(view: OpsIntentView): void {
  useViewIntent.getState().consume(view);
}

/** Asks `view` to select the customer / sub tab once it is shown. */
export function requestOpsIntent(view: OpsIntentView, intent: OpsIntent): void {
  useViewIntent.getState().request(view, encodeOpsIntent(intent));
}

/** Tab and hand-off of a dashboard todo (`route` from the API, the customer selected on arrival). */
export function todoTarget(todo: OpsTodo): { ref: TabRef; view: OpsIntentView; intent: OpsIntent } | null {
  if (!isRouteKey(todo.route) || (todo.route !== "opsSetup" && todo.route !== "opsStandards")) return null;
  const intent: OpsIntent = { customerId: todo.customerId };
  if (todo.sub) intent.sub = todo.sub;
  return { ref: { route: todo.route, params: {} }, view: todo.route, intent };
}

/** Opens a todo: the hand-off first, then the tab (the view reads the intent when it renders). */
export function openTodo(todo: OpsTodo, openTab: (ref: TabRef) => void): void {
  const target = todoTarget(todo);
  if (!target) return;
  requestOpsIntent(target.view, target.intent);
  openTab(target.ref);
}

/**
 * After 고객사 생성 (reference: `S.cid` switches to the new customer and 초기 설정·시드 opens on it): the
 * top bar context, then the setup tab selecting that customer.
 */
export function continueToSetup(customerId: number, openTab: (ref: TabRef) => void): void {
  useWorkContextStore.getState().setCustomer(customerId, null);
  requestOpsIntent("opsSetup", { customerId });
  openTab({ route: "opsSetup", params: {} });
}
