import type { ProjectVariableLog } from "./types";

/**
 * Groups the project log (`GET /api/projects/{id}/variable-logs`, newest first) per variable, oldest
 * first inside each group — the order of the reference 이력 cell (`v.log` is appended to).
 */
export function logsByVariable(logs: readonly ProjectVariableLog[]): Map<number, ProjectVariableLog[]> {
  const groups = new Map<number, ProjectVariableLog[]>();
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    const group = groups.get(log.variableId);
    if (group) group.push(log);
    else groups.set(log.variableId, [log]);
  }
  return groups;
}
