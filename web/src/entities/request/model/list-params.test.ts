import { describe, expect, it } from "vitest";
import { buildUrl } from "@/shared/api";
import { LIST_PAGE_SIZE } from "@/shared/lib";
import {
  EMPTY_REQUEST_FILTERS,
  filtersToListParams,
  statusListParams,
  viewListParams,
} from "./list-params";

describe("filtersToListParams", () => {
  it("sends only the project and paging for empty filters", () => {
    expect(filtersToListParams(1, EMPTY_REQUEST_FILTERS)).toEqual({ projectId: 1, page: 0, size: LIST_PAGE_SIZE });
    expect(LIST_PAGE_SIZE).toBe(20);
  });

  it("maps every filter control to its contract query key", () => {
    const params = filtersToListParams(
      1,
      {
        q: "  포인트 ",
        type: "ALIMTALK",
        status: "IN_REVIEW",
        leadUserId: 3,
        primaryReviewerId: 2,
        reviewerId: 6,
        dueFrom: "2026-10-01",
        dueTo: "2026-10-31",
        submittedFrom: "2026-09-01",
        submittedTo: "2026-09-30",
        mine: true,
      },
      2,
    );
    expect(params).toEqual({
      projectId: 1,
      page: 2,
      size: LIST_PAGE_SIZE,
      q: "포인트",
      type: "ALIMTALK",
      status: "IN_REVIEW",
      leadUserId: 3,
      primaryReviewerId: 2,
      reviewerId: 6,
      dueFrom: "2026-10-01",
      dueTo: "2026-10-31",
      submittedFrom: "2026-09-01",
      submittedTo: "2026-09-30",
      mine: true,
    });
  });

  it("omits whitespace-only search and unchecked mine", () => {
    const params = filtersToListParams(1, { ...EMPTY_REQUEST_FILTERS, q: "   ", mine: false });
    expect(params).not.toHaveProperty("q");
    expect(params).not.toHaveProperty("mine");
  });

  it("produces the expected URL", () => {
    const params = filtersToListParams(1, { ...EMPTY_REQUEST_FILTERS, status: "DRAFT", mine: true });
    expect(buildUrl("/requests", { ...params })).toBe("/api/requests?projectId=1&page=0&size=20&status=DRAFT&mine=true");
  });
});

describe("viewListParams", () => {
  const scope = { projectId: 1, customerId: 7 };

  it("scopes project views by projectId", () => {
    expect(viewListParams("MY_REVIEW", scope)).toEqual({ projectId: 1, view: "MY_REVIEW", page: 0, size: 100 });
  });

  it("scopes customer views by customerId", () => {
    expect(viewListParams("CUSTOMER_IN_PROGRESS", scope)).toEqual({
      customerId: 7,
      view: "CUSTOMER_IN_PROGRESS",
      page: 0,
      size: 100,
    });
    expect(viewListParams("CUSTOMER_COMPLETED", scope, 1)).toMatchObject({ customerId: 7, size: 1 });
  });

  it("maps a pipeline stage to a status filter without a view", () => {
    expect(statusListParams(1, "APPROVED")).toEqual({ projectId: 1, status: "APPROVED", page: 0, size: 100 });
  });
});
