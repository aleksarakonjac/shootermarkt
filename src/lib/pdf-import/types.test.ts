import { describe, expect, it } from "vitest";
import { mergeFinalsIntoRows, type ParsedEvent, type ReviewRow } from "./types";

const foldName = (value: string) => value.toLowerCase();

describe("mergeFinalsIntoRows", () => {
  it("stores final score and rank separately from qualification", () => {
    const rows: ReviewRow[] = [{
      firstName: "Marko",
      lastName: "Petrović",
      teamNoc: "SRB",
      disciplineCode: "ARM",
      category: "senior",
      qualTotal: 628.4,
      qualRank: 3,
      qualified: true,
    }];
    const events: ParsedEvent[] = [{
      discipline: "ARM",
      stage: "final",
      category: "senior",
      results: [{ rank: 1, firstName: "Marko", lastName: "Petrović", teamNoc: "SRB", total: 251.2 }],
    }];

    const result = mergeFinalsIntoRows(rows, events, foldName);

    expect(result).toMatchObject({ matchedFinals: 1, unmatchedFinals: 0 });
    expect(rows[0]).toMatchObject({ qualTotal: 628.4, qualRank: 3, finalTotal: 251.2, finalRank: 1 });
  });

  it("matches a final even when Gemini assigns a different age category", () => {
    const rows: ReviewRow[] = [{
      firstName: "Ana",
      lastName: "Jovanović",
      teamNoc: "SRB",
      disciplineCode: "ARW",
      category: "junior",
      qualTotal: 625.8,
    }];
    const events: ParsedEvent[] = [{
      discipline: "ARW",
      stage: "final",
      category: "senior",
      results: [{ rank: 2, firstName: "Ana", lastName: "Jovanović", teamNoc: "SRB", total: 248.6 }],
    }];

    const result = mergeFinalsIntoRows(rows, events, foldName);

    expect(result).toMatchObject({ matchedFinals: 1, unmatchedFinals: 0 });
    expect(rows[0]).toMatchObject({ finalTotal: 248.6, finalRank: 2, qualified: true });
  });
});
