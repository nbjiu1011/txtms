import type { QueryClient } from "@tanstack/react-query";
import { auditKeys } from "@/entities/audit";
import { projectKeys } from "@/entities/project";
import { memberKeys } from "@/entities/user";

/** After a user write: members, user directory, projects (roles/lead), outbox and audit lists. */
export function invalidateUserData(client: QueryClient): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: memberKeys.all }),
    client.invalidateQueries({ queryKey: ["users"] }),
    client.invalidateQueries({ queryKey: projectKeys.all }),
    client.invalidateQueries({ queryKey: auditKeys.outboxAll }),
    client.invalidateQueries({ queryKey: auditKeys.logsAll }),
  ]);
}
