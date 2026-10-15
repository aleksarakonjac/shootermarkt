import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi, describe, expect, it } from "vitest";
import { Ticker, selectTickerCycleItems, type TickerItem } from "./ticker";

vi.mock("next-intl", () => ({ useLocale: () => "sr", useTranslations: () => () => "" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("@/hooks/use-scoped-href", () => ({ useScopedHref: () => (href: string) => href }));

const item: TickerItem = {
  id: 1, name: "Kup Srbije", date: "2026-07-30", level: "national", status: "LIVE",
  detailItems: [{ text: "ARM · Kvalifikacije" }, { text: "TOP 3" }],
};

describe("Ticker", () => {
  it("keeps one upcoming competition static", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const view = render(<Ticker upcomingItems={[{ ...item, status: "USKORO" }]} />);

    expect(view.getAllByText("Kup Srbije")).toHaveLength(1);
  });

  it("keeps rendering when a rotated detail list shrinks", () => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const view = render(<Ticker liveItems={[item]} />);

    act(() => { vi.advanceTimersByTime(4_350); });
    expect(() => view.rerender(<Ticker liveItems={[{ ...item, detailItems: [item.detailItems![0]] }]} />)).not.toThrow();
    vi.useRealTimers();
  });
});

describe("selectTickerCycleItems", () => {
  const today = new Date();
  const iso = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days).toLocaleDateString("sv-SE");
  const live = { ...item, id: 1, status: "LIVE" as const };
  const next = { ...item, id: 2, status: "NEXT" as const };
  const review = { ...item, id: 3, status: "REVIEW" as const };
  const soon = { ...item, id: 4, status: "USKORO" as const, date: iso(1) };

  it("shows only live items while a discipline is live", () => {
    expect(selectTickerCycleItems([next, live, review], [soon]).map((i) => i.id)).toEqual([1]);
  });

  it("falls back to ongoing competitions plus imminent upcoming when nothing is live", () => {
    expect(selectTickerCycleItems([next, review], [soon, { ...soon, id: 5, date: iso(10) }]).map((i) => i.id)).toEqual([2, 3, 4]);
  });

  it("is empty when no competition is on", () => {
    expect(selectTickerCycleItems([], [soon])).toEqual([]);
  });
});
