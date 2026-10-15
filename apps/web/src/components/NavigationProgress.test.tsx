import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/sr/srb", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { NavigationProgress, startNavigationProgress } from "./NavigationProgress";

function clickLink(href: string, init: MouseEventInit = {}) {
  const a = document.createElement("a");
  a.href = href;
  a.addEventListener("click", (event) => event.preventDefault());
  document.body.appendChild(a);
  act(() => { a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init })); });
  a.remove();
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/sr/srb");
  nav.pathname = "/sr/srb";
  nav.search = "";
});
afterEach(() => vi.useRealTimers());

describe("NavigationProgress", () => {
  it("shows the bar after a short delay on an internal link click and hides it once the route changes", () => {
    const { rerender } = render(<NavigationProgress />);
    clickLink("/sr/srb/strelci");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    nav.pathname = "/sr/srb/strelci";
    rerender(<NavigationProgress />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("never shows for navigations faster than the delay", () => {
    const { rerender } = render(<NavigationProgress />);
    clickLink("/sr/srb/takmicenja");
    nav.pathname = "/sr/srb/takmicenja";
    rerender(<NavigationProgress />);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("ignores same-page, external and modified clicks", () => {
    render(<NavigationProgress />);
    clickLink("/sr/srb#top");
    clickLink("https://example.com/");
    clickLink("/sr/srb/strelci", { ctrlKey: true });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("treats a locale-less router href to the current page as no navigation", () => {
    render(<NavigationProgress />);
    act(() => startNavigationProgress("/srb"));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("gives up after the safety timeout", () => {
    render(<NavigationProgress />);
    act(() => startNavigationProgress("/srb/strelci"));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(15_000 + 400));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
