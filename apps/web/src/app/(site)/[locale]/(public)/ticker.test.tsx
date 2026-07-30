import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi, describe, expect, it } from "vitest";
import { Ticker, type TickerItem } from "./ticker";

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
