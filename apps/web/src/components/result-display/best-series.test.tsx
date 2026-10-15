import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeriesQualDisplay } from "./SeriesQualDisplay";
import { PositionsQualDisplay } from "./PositionsQualDisplay";

const highlighted = (el: HTMLElement) => el.className.includes("text-[var(--ink)]");

describe("best series highlight", () => {
  it("highlights every series tied for the best, not just the first", () => {
    render(<SeriesQualDisplay detail={{ series: [98, 100, 97, 100, 99, 100] }} showTotal={false} />);
    const cells = screen.getAllByRole("cell");
    expect(cells.map(highlighted)).toEqual([false, true, false, true, false, true]);
  });

  it("highlights tied best series within a 3-position row", () => {
    const tenShots = (score: number) => Array.from({ length: 10 }, () => score / 10);
    render(
      <PositionsQualDisplay
        showGrandTotal={false}
        detail={{
          kneeling: { series: [tenShots(100), tenShots(98), tenShots(100), tenShots(99)] },
          prone: { series: [tenShots(99), tenShots(99), tenShots(98), tenShots(97)] },
          standing: { series: [tenShots(95), tenShots(96), tenShots(94), tenShots(93)] },
        } as never}
      />,
    );
    const kneelingRow = screen.getByText("Klečeći").closest("tr")!;
    const cells = [...kneelingRow.querySelectorAll("td")].slice(1, 5) as HTMLElement[];
    expect(cells.map((c) => c.textContent)).toEqual(["100", "98", "100", "99"]);
    expect(cells.map(highlighted)).toEqual([true, false, true, false]);
  });
});
