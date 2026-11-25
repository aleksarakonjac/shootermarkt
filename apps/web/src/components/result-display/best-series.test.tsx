import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultDetailPanel } from "./ResultDetailPanel";

vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const base = { elimDetail: null, elimTotal: null, elimRank: null, qualRank: 1, qualScore: "x", locale: "sr", finalDetail: null, finalScore: null, finalRank: null };
const highlighted = (el: HTMLElement) => el.className.includes("font-semibold");
const chips = (texts: string[]) => texts.flatMap((t) => screen.getAllByText(t)).filter((el, i, a) => a.indexOf(el) === i).sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));

describe("best series highlight", () => {
  it("highlights every series tied for the best, not just the first", () => {
    render(<ResultDetailPanel {...base} disciplineCode="APM" qualDetail={{ series: [98, 100, 97, 100, 99, 100] }} />);
    const cells = chips(["98", "100", "97", "99"]);
    expect(cells.map((c) => c.textContent)).toEqual(["98", "100", "97", "100", "99", "100"]);
    expect(cells.map(highlighted)).toEqual([false, true, false, true, false, true]);
  });

  it("highlights tied best series within a 3-position group", () => {
    const tenShots = (score: number) => Array.from({ length: 10 }, () => score / 10);
    render(
      <ResultDetailPanel
        {...base}
        disciplineCode="R3PM"
        qualDetail={{
          kneeling: { series: [tenShots(100), tenShots(98), tenShots(100), tenShots(99)], total: 397 },
          prone: { series: [tenShots(91), tenShots(92), tenShots(93), tenShots(94)], total: 370 },
          standing: { series: [tenShots(85), tenShots(86), tenShots(87), tenShots(88)], total: 346 },
        }}
      />,
    );
    const kneeling = screen.getByText("Klečeći").closest("div")!;
    const cells = [...kneeling.querySelectorAll("div > span")].filter((el) => /^\d+$/.test(el.textContent ?? "")) as HTMLElement[];
    expect(cells.map((c) => c.textContent)).toEqual(["100", "98", "100", "99"]);
    expect(cells.map(highlighted)).toEqual([true, false, true, false]);
  });
});
