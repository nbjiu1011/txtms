import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DatePicker, DateRangePicker } from "./date-picker";
import { pickDate, pickRange } from "./testing";

function Single(props: { initial?: string; min?: string; required?: boolean }) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <>
      <label htmlFor="due">확정 납기</label>
      <DatePicker id="due" value={value} onChange={setValue} min={props.min} required={props.required} />
      <output data-testid="value">{value}</output>
    </>
  );
}

function Range() {
  const [range, setRange] = useState({ from: "", to: "" });
  return (
    <>
      <DateRangePicker aria-label="접수일" from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
      <output data-testid="range">{`${range.from}|${range.to}`}</output>
    </>
  );
}

const value = () => screen.getByTestId("value").textContent;

describe("DatePicker", () => {
  it("is a labelled field that shows the day with its weekday and picks from the calendar", () => {
    render(<Single initial="2026-10-14" />);
    const field = screen.getByLabelText("확정 납기");
    expect(field.textContent).toContain("2026-10-14 (수)");
    pickDate(field, "2026-11-03");
    expect(value()).toBe("2026-11-03");
    expect(screen.queryByRole("grid")).toBeNull(); // closes after a pick
  });

  it("clears unless required, and refuses days before min", () => {
    render(<Single initial="2026-10-14" min="2026-10-10" />);
    const field = screen.getByLabelText("확정 납기");
    fireEvent.click(field);
    expect((document.querySelector('[data-day="2026-10-09"]') as HTMLButtonElement).disabled).toBe(true);
    expect((document.querySelector('[data-day="2026-10-10"]') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    expect(value()).toBe("");
  });

  it("offers no 지우기 for a required date", () => {
    render(<Single initial="2026-10-14" required />);
    fireEvent.click(screen.getByLabelText("확정 납기"));
    expect(screen.queryByRole("button", { name: "지우기" })).toBeNull();
  });

  it("moves by day with the arrow keys and picks with Enter", () => {
    render(<Single initial="2026-10-14" />);
    fireEvent.click(screen.getByLabelText("확정 납기"));
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    const cursor = grid.querySelector<HTMLButtonElement>('[data-cursor="true"]')!;
    expect(cursor.dataset.day).toBe("2026-10-22");
    fireEvent.click(cursor);
    expect(value()).toBe("2026-10-22");
  });
});

describe("DateRangePicker", () => {
  it("takes the first pick as start and the second as end, in either order", () => {
    render(<Range />);
    const field = screen.getByLabelText("접수일");
    expect(field.textContent).toContain("전체 기간");
    pickRange(field, "2026-10-20", "2026-10-03");
    expect(screen.getByTestId("range").textContent).toBe("2026-10-03|2026-10-20");
    expect(field.textContent).toContain("2026-10-03 ~ 2026-10-20");
  });

  it("applies a quick pick at once and clears with 전체 기간", () => {
    render(<Range />);
    const field = screen.getByLabelText("접수일");
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("button", { name: "오늘" }));
    const [from, to] = screen.getByTestId("range").textContent!.split("|");
    expect(from).toBe(to);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    pickRange(field, "", "");
    expect(screen.getByTestId("range").textContent).toBe("|");
  });
});
