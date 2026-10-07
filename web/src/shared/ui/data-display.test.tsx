import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListItem } from "./data-display";

describe("ListItem with its own trailing buttons (nestedActions)", () => {
  it("makes the title part the button, keeps the trailing button outside it, and the row clickable", () => {
    const onClick = vi.fn();
    const onAction = vi.fn();
    render(
      <ListItem
        nestedActions
        title="추석 연휴 고객센터 운영 안내"
        meta="REQ-2609-104"
        onClick={onClick}
        trailing={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
          >
            배정
          </button>
        }
      />,
    );
    const row = screen.getByRole("button", { name: /추석 연휴 고객센터 운영 안내/ });
    const action = screen.getByRole("button", { name: "배정" });
    // no interactive element nested inside another (axe `nested-interactive`)
    expect(row.contains(action)).toBe(false);
    expect(row.querySelector("button")).toBeNull();

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(row.parentElement as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(2);
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
