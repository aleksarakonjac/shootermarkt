import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSection, type ScheduleSlot } from "./ScheduleSection";

describe("ScheduleSection", () => {
  it("starts collapsed even while a phase is live", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const start = new Date(Date.now() - 30 * 60_000).toISOString();
    const end = new Date(Date.now() + 30 * 60_000).toISOString();
    const slots: ScheduleSlot[] = [{ id: 1, disciplineCode: "ARW", stage: "qual", category: "senior", startTime: start, endTime: end }];
    render(<ScheduleSection slots={slots} locale="sr" timezone="Europe/Belgrade" />);

    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  it("renders nothing without slots and survives slots arriving later", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { container, rerender } = render(<ScheduleSection slots={[]} locale="sr" timezone="UTC" />);
    expect(container).toBeEmptyDOMElement();

    const slot: ScheduleSlot = { id: 1, disciplineCode: "ARM", stage: "final", category: "senior", startTime: new Date().toISOString(), endTime: null };
    expect(() => rerender(<ScheduleSection slots={[slot]} locale="sr" timezone="UTC" />)).not.toThrow();
  });
});
