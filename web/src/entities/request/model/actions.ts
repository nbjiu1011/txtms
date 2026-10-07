import type { RequestAction } from "./types";

/**
 * Request actions whose flows exist in this web build. Buttons are rendered only for actions that
 * the server allows (`allowedActions`) AND that are listed here; later milestones extend the list.
 */
export const IMPLEMENTED_ACTIONS: ReadonlySet<RequestAction> = new Set<RequestAction>([]);

/** Server-allowed actions this build can perform. */
export function performableActions(
  allowed: readonly RequestAction[],
  implemented: ReadonlySet<RequestAction> = IMPLEMENTED_ACTIONS,
): Set<RequestAction> {
  return new Set(allowed.filter((a) => implemented.has(a)));
}

/** Creating a request (`POST /api/requests`) is available in this build. */
export const REQUEST_CREATE_IMPLEMENTED = false;
