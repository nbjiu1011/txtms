import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { projectKeys } from "@/entities/project";
import { userKeys } from "@/entities/user";
import { invalidateOps } from "./invalidate";

describe("invalidateOps", () => {
  it("marks every list stale but leaves the customer API lists of a deactivated customer alone", async () => {
    const client = new QueryClient();
    for (const key of [projectKeys.byCustomer(1), projectKeys.byCustomer(11), userKeys.byCustomer(11)]) {
      client.setQueryData(key, []);
    }
    await invalidateOps(client, 11);
    expect(client.getQueryState(projectKeys.byCustomer(1))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectKeys.byCustomer(11))?.isInvalidated).toBe(false);
    expect(client.getQueryState(userKeys.byCustomer(11))?.isInvalidated).toBe(false);
    await invalidateOps(client);
    expect(client.getQueryState(projectKeys.byCustomer(11))?.isInvalidated).toBe(true);
  });
});
