import type { QueryClient } from "@tanstack/react-query";
import { customerKeys } from "@/entities/customer";
import { opsKeys } from "@/entities/ops";
import { projectKeys } from "@/entities/project";
import { requestKeys } from "@/entities/request";

/**
 * After an operator write: every operator list (shared `ops` prefix) plus the shell lists that show
 * the same data (top bar customers and projects, user directory, content types of the request forms).
 */
export function invalidateOps(client: QueryClient): Promise<unknown> {
  return Promise.all([
    client.invalidateQueries({ queryKey: opsKeys.all }),
    client.invalidateQueries({ queryKey: customerKeys.all }),
    client.invalidateQueries({ queryKey: projectKeys.all }),
    client.invalidateQueries({ queryKey: ["users"] }),
    client.invalidateQueries({ queryKey: ["content-types"] }),
    client.invalidateQueries({ queryKey: requestKeys.all }),
  ]);
}
