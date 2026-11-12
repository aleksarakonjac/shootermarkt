import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSection, type ScheduleExtra, type ScheduleSlot } from "./ScheduleSection";

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

  it("shows training and other items only after the toggle is switched on", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const slots: ScheduleSlot[] = [{ id: 1, disciplineCode: "ARM", stage: "qual", category: "senior", startTime: "2026-11-03T06:00:00.000Z", endTime: null }];
    const extras: ScheduleExtra[] = [
      { id: 1, kind: "training", title: "Pre-event Training 10m Air Rifle Men", disciplineCode: "ARM", startTime: "2026-11-02T05:00:00.000Z", endTime: null },
      { id: 2, kind: "other", title: "Equipment Control", disciplineCode: null, startTime: "2026-11-02T04:00:00.000Z", endTime: null },
    ];
    render(<ScheduleSection slots={slots} extras={extras} locale="sr" timezone="Asia/Qatar" />);

    expect(screen.queryByText("Equipment Control")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Treninzi i ostalo/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Equipment Control")).toBeInTheDocument();
    expect(screen.getByText("Trening")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText("Equipment Control")).not.toBeInTheDocument();
  });

  it("offers no toggle when there are no extra items", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const slots: ScheduleSlot[] = [{ id: 1, disciplineCode: "ARM", stage: "qual", category: "senior", startTime: "2026-11-03T06:00:00.000Z", endTime: null }];
    render(<ScheduleSection slots={slots} locale="sr" timezone="Asia/Qatar" />);
    expect(screen.queryByRole("button", { name: /Treninzi i ostalo/ })).not.toBeInTheDocument();
  });

  it("shows only Olympic disciplines by default and the rest after the toggle", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const slots: ScheduleSlot[] = [
      { id: 1, disciplineCode: "ARM", stage: "qual", category: "senior", startTime: "2026-11-03T06:00:00.000Z", endTime: null },
      { id: 2, disciplineCode: "RPRM", stage: "qual", category: "senior", startTime: "2026-11-03T08:00:00.000Z", endTime: null },
    ];
    render(<ScheduleSection slots={slots} locale="sr" timezone="Asia/Qatar" />);

    expect(screen.getAllByText("ARM").length).toBeGreaterThan(0);
    expect(screen.queryByText("RPRM")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Neolimpijske discipline/ });
    fireEvent.click(toggle);
    expect(screen.getAllByText("RPRM").length).toBeGreaterThan(0);

    fireEvent.click(toggle);
    expect(screen.queryByText("RPRM")).not.toBeInTheDocument();
  });

  it("shows everything, with no toggle, when no discipline is Olympic", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const slots: ScheduleSlot[] = [{ id: 1, disciplineCode: "RPRM", stage: "qual", category: "senior", startTime: "2026-11-03T06:00:00.000Z", endTime: null }];
    render(<ScheduleSection slots={slots} locale="sr" timezone="Asia/Qatar" />);
    expect(screen.getAllByText("RPRM").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Neolimpijske discipline/ })).not.toBeInTheDocument();
  });
});

