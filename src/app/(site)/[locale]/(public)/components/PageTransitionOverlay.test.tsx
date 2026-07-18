import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageTransitionOverlay, startPageTransitionSplash } from "./PageTransitionOverlay";

afterEach(() => vi.useRealTimers());

describe("PageTransitionOverlay", () => {
  it("keeps the splash visible for three seconds after a transition ends", () => {
    vi.useFakeTimers();
    startPageTransitionSplash();
    const { rerender } = render(<PageTransitionOverlay visible />);

    rerender(<PageTransitionOverlay visible={false} />);
    act(() => vi.advanceTimersByTime(2_999));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
