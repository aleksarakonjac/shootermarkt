import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PullToRefresh, pullDistance, PULL_THRESHOLD } from "./PullToRefresh";

function touch(type: string, y: number, x = 100) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: Array<{ clientX: number; clientY: number }> };
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
  act(() => { window.dispatchEvent(event); });
}

function mockStandalone(standalone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: standalone && query.includes("standalone"), addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => { window.scrollTo = vi.fn(); Object.defineProperty(window, "scrollY", { value: 0, configurable: true }); });
afterEach(() => vi.unstubAllGlobals());

describe("PullToRefresh", () => {
  it("applies resistance and caps the indicator travel", () => {
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(-20)).toBe(0);
    expect(pullDistance(1000)).toBe(110);
  });

  it("refreshes after a long enough pull from the top in an installed app", () => {
    mockStandalone(true);
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh} />);
    touch("touchstart", 100);
    touch("touchmove", 100 + PULL_THRESHOLD * 2 + 10);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Pusti za osvežavanje");
    touch("touchend", 0);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on a short pull", () => {
    mockStandalone(true);
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh} />);
    touch("touchstart", 100);
    touch("touchmove", 140);
    touch("touchend", 0);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays off in a normal browser tab (native pull-to-refresh handles it)", () => {
    mockStandalone(false);
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh} />);
    touch("touchstart", 100);
    touch("touchmove", 400);
    touch("touchend", 0);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores pulls when the page is scrolled down", () => {
    mockStandalone(true);
    Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh} />);
    touch("touchstart", 100);
    touch("touchmove", 400);
    touch("touchend", 0);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
