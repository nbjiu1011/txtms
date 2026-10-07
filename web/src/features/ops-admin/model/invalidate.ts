import type { QueryClient } from "@tanstack/react-query";
import { customerKeys } from "@/entities/customer";
import { opsKeys } from "@/entities/ops";
import { projectKeys } from "@/entities/project";
import { requestKeys } from "@/entities/request";
import { userKeys } from "@/entities/user";

const sameKey = (a: readonly unknown[], b: readonly unknown[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * After an operator write: every operator list (shared `ops` prefix) plus the shell lists that show
 * the same data (top bar customers and projects, user directory, content types of the request forms).
 * `deactivatedCustomerId`: its customer API lists answer 404 from now on — they are marked stale but
 * not refetched while the top bar still points at the customer (it moves on once the lists reload).
 */
export function invalidateOps(client: QueryClient, deactivatedCustomerId?: number): Promise<unknown> {
  const gone = deactivatedCustomerId;
  const keep = (key: readonly unknown[]) =>
    gone === undefined ||
    (!sameKey(key, projectKeys.byCustomer(gone)) && !sameKey(key, userKeys.byCustomer(gone)));
  return Promise.all([
    client.invalidateQueries({ queryKey: opsKeys.all }),
    client.invalidateQueries({ queryKey: customerKeys.all }),
    client.invalidateQueries({ queryKey: projectKeys.all, predicate: (q) => keep(q.queryKey) }),
    client.invalidateQueries({ queryKey: ["users"], predicate: (q) => keep(q.queryKey) }),
    client.invalidateQueries({ queryKey: ["content-types"] }),
    client.invalidateQueries({ queryKey: requestKeys.all }),
  ]);
}
