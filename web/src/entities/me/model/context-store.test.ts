import { afterEach, describe, expect, it } from "vitest";
import { useWorkContextStore } from "./context-store";

afterEach(() => useWorkContextStore.getState().reset());

describe("work context store", () => {
  it("forgetCustomer clears the selection only when that customer is selected", () => {
    useWorkContextStore.getState().setCustomer(9, 12);
    useWorkContextStore.getState().forgetCustomer(3);
    expect(useWorkContextStore.getState()).toMatchObject({ customerId: 9, projectId: 12 });
    useWorkContextStore.getState().forgetCustomer(9);
    expect(useWorkContextStore.getState()).toMatchObject({ customerId: null, projectId: null });
  });
});
